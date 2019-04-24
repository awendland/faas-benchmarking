const aws = require('aws-sdk')
const archiver = require('archiver')
const path = require('path')
const { sleep } = require('../../utils')

module.exports.AwsProvider = {
  create: async ({
    projectName,
    logger,
    region,
    credentials,
  } = {
    region: 'us-east-1',
    credentials: undefined,
  }) => {
    aws.config.region = region
    if (credentials) aws.config.credentials
    const s3 = new aws.S3({ apiVersion: '2006-03-01' })
    const iam = new aws.IAM({ apiVersion: '2010-05-08' })
    const lambda = new aws.Lambda({ apiVersion: '2015-03-31' })
    const apigtw = new aws.APIGateway({apiVersion: '2015-07-09'})

    const { User: { Arn: userIamArn } } = await iam.getUser().promise()
    const accountId = userIamArn.match(/iam::(\d+):user/)[1]
    const Tags = { 'Project': projectName }
    const faasRestGatewayStage = 'test'

    let faasSrcBucket, faasIamRole, faasRestGateway

    ////////////////////
    // Public Methods //
    ////////////////////

    const thiz = {
      vm: {
        // TODO
      },

      objectStorage: {
        uploadFile: async (bucket, key, data) => {
          logger.debug(`Uploading file to s3://${bucket}/${key}`)
          const { Location } = await s3.upload({ Bucket: bucket, Key: key, Body: data }).promise()
          logger.debug(`Finished uploading to s3://${bucket}/${key}`)
          return Location
        },
      },

      faas: {
        prepareHttpTrigger: async () => {
          if (!faasRestGateway) await createApiGateway()
          if (!faasIamRole) await createLambdaIAMRole()
        },

        prepareHandlerCode: async (name, sourceDir, handlerId) => {
          if (!faasSrcBucket) {
            faasSrcBucket = `${projectName}-faas-src`
            logger.debug(`Creating new FaaS source bucket called "${faasSrcBucket}"`)
            await s3.createBucket({ Bucket: faasSrcBucket }).promise()
            logger.debug(`Finished creating FaaS source bucket called "${faasSrcBucket}"`)
          }
          logger.debug(`Creating Lambda archive of "${path.relative('.', sourceDir)}"`)
          const archive = archiver('zip')
          archive.on('error', err => { throw err })
          archive.directory(sourceDir, false)
          archive.finalize()
          await thiz.objectStorage.uploadFile(faasSrcBucket, name, archive)
          return {
            handlerId,
            location: { S3Bucket: faasSrcBucket, S3Key: name },
          }
        },

        createHttpFunction: async ({
          handlerCode, // type HandlerCode = { S3Bucket: string, S3Key: string, handlerId: string }
          name,
          size,
          runtime,
          timeout,
        } = {
          timeout: 300
        }) => {
          // Create the Lambda
          const lambdaRuntime = LAMBDA_RUNTIMES[runtime]
          logger.debug(`Creating Lambda "${name}" w/ mem=${size} timeout=${timeout} runtime=${lambdaRuntime}`)
          const { FunctionArn } = await lambda.createFunction({
            Code: handlerCode.location,
            FunctionName: name,
            Handler: handlerCode.handlerId,
            Role: faasIamRole,
            Timeout: timeout,
            Runtime: lambdaRuntime,
            MemorySize: size,
            Publish: true,
            Tags,
          }).promise()
          // Connect the Lambda to the API Gateway
          await addLambdaToApiGateway({ name, lambdaArn: FunctionArn })
          return {
            name,
            arn: FunctionArn,
            // NOTE API Gateway only works over HTTPS
            url: `https://${faasRestGateway.restApiId}.execute-api.${region}.amazonaws.com/${faasRestGatewayStage}/${name}`,
          }
        },

        publishHttpFunctions: async () => {
          logger.debug(`Deploying API Gateway "${faasRestGateway.restApiId}" to "${faasRestGatewayStage}"`)
          const { deploymentId } = await apigtw.createDeployment({
            restApiId: faasRestGateway.restApiId,
            stageName: faasRestGatewayStage,
          }).promise()
          // await apigtw.createStage({
          //   restApiId: faasRestGateway.restApiId,
          //   stageName: faasRestGatewayStage,
          //   deploymentId
          //   patchOperations: [{ op: 'replace', path: '/deploymentId', value: deploymentId }],
          // })
        },
      },
    }

    /////////////////////
    // Private Helpers //
    /////////////////////

    const LAMBDA_POLICY = {
      'Version': '2012-10-17',
      'Statement': [
        {
          'Effect': 'Allow',
          'Principal': {
            'Service': 'lambda.amazonaws.com'
          },
          'Action': 'sts:AssumeRole'
        }
      ]
    }

    const LAMBDA_RUNTIMES = {
      'Node8': 'nodejs8.10',
    }

    // TODO make these operations transactional

    const createApiGateway = async () => {
      logger.debug(`Creating RestAPI on API Gateway for "${projectName}"`)
      const { id: restApiId } = await apigtw.createRestApi({
        name: projectName,
        description: `${new Date()}`,
        endpointConfiguration: { types: ["REGIONAL"] },
      }).promise()
      const { items } = await apigtw.getResources({ restApiId }).promise()
      faasRestGateway = { restApiId, parentId: items[0].id }
      logger.debug(`Created API Gateway for "${projectName}" rest_api_id=${restApiId} parent_id=${faasRestGateway.parentId}`)
    }

    const createLambdaIAMRole = async () => {
      const RoleName = process.env['IAM_ROLE'] || `${projectName}-faas`
      try {
        const roleResp = await iam.getRole({ RoleName }).promise()
        faasIamRole = roleResp.Role.Arn
        logger.debug(`Using existing IAM user "${faasIamRole}" for Lambdas`)
      } catch (e) {
        logger.debug(`Creating IAM user "${RoleName}" for Lambdas`)
        const createRoleResp = await iam.createRole({
          AssumeRolePolicyDocument: JSON.stringify(LAMBDA_POLICY),
          RoleName,
        }).promise()
        await iam.attachRolePolicy({
           PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaRole',
           RoleName,
        }).promise()
        faasIamRole = createRoleResp.Role.Arn
        await sleep(8000)
        logger.debug(`Finished setting up IAM user "${faasIamRole}"`)
      }
    }

    const addLambdaToApiGateway = async ({ name, lambdaArn }) => {
      // TODO add way to delete these integrations
      logger.debug(`Creating API Gateway resource at "/${name}"`)
      const { id: apiGtwResId, path: apiGtwResPath } = await apigtw.createResource({
        ...faasRestGateway,
        pathPart: name,
      }).promise()

      const integrationParams = {
        restApiId: faasRestGateway.restApiId,
        resourceId: apiGtwResId,
        httpMethod: 'POST',
      }

      logger.debug(`Creating ${integrationParams.httpMethod} for "/${name}"`)
      await apigtw.putMethod({ ...integrationParams, authorizationType: 'NONE' }).promise()
      logger.debug(`Linking ${integrationParams.httpMethod} "/${name}" to Lambda`)
      await apigtw.putIntegration({
        ...integrationParams,
        type: 'AWS_PROXY',
        uri: `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${region}:${accountId}:function:${name}/invocations`,
        integrationHttpMethod: 'POST',
        // requestTemplates: {
        //   'application/json': `{
  // "body" : $input.json('$'),
  // "headers": {
    // #foreach($param in $input.params().header.keySet())
    // "$param": "$util.escapeJavaScript($input.params().header.get($param))" #if($foreach.hasNext),#end
    
    // #end  
  // }
// }`,
        // },
      }).promise()
      logger.debug(`Creating response for ${integrationParams.httpMethod} "/${name}"`)
      await apigtw.putMethodResponse({
        ...integrationParams,
        statusCode: '200',
        responseModels: { 'application/json': 'Empty' },
      }).promise()
      logger.debug(`Linking Lambda response to ${integrationParams.httpMethod} "/${name}"`)
      await apigtw.putIntegrationResponse({
        ...integrationParams,
        statusCode: '200',
        responseTemplates: { 'application/json': '' },
      }).promise()
      logger.debug(`Granting API Gateway permission to invoke Lambda "${name}"`)
      await lambda.addPermission({
          Action: 'lambda:InvokeFunction',
          FunctionName: lambdaArn,
          Principal: 'apigateway.amazonaws.com',
          SourceArn: `arn:aws:execute-api:${region}:${accountId}:${faasRestGateway.restApiId}/*/${integrationParams.httpMethod}${apiGtwResPath}`,
          StatementId: `api-gateway-${name}`,
      }).promise()
    }

    return thiz
  }
}
