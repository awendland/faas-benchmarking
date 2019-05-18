const initTime = Date.now()
let runCount = 0
const id = require('crypto')
  .randomBytes(16)
  .toString('base64')
  .replace('==', '')

/////////////
// Imports //
/////////////

const http = require('http')
const url = require('url')

///////////
// Utils //
///////////

const delay = ms => new Promise(res => setTimeout(() => res(), ms))

const tryToParseJsonObj = str => {
  try {
    return JSON.parse(str)
  } catch {
    return {}
  }
}

//////////////////////
// Standard Handler //
//////////////////////

module.exports.handler = async args => {
  const { triggeredTime, requestId, sleep, webhook, ...providerData } = args
  process.stdout.write(
    `run_count=${runCount++} init_time=${initTime} triggered_time=${triggeredTime} sleep=${sleep} webhook=${webhook}\n`,
  )
  if (sleep) {
    await delay(sleep)
  }
  const bodyTemplate = JSON.stringify({
    id,
    initTime,
    runCount,
    triggeredTime,
    processingTime: 'PROCESSING_TIME', // To be replaced w/
    requestId,
    sleep,
    webhook,
    providerData,
  })
  const bodyLatest = () =>
    bodyTemplate.replace('PROCESSING_TIME', Date.now() - triggeredTime)
  if (webhook) {
    await new Promise((resolve, reject) => {
      // TODO better socket timing (open socket, then record time and send HTTP request manually, with updated time)
      const request = http.request(
        {
          method: 'POST',
          ...url.parse(webhook),
          timeout: 3 * 1000,
        },
        resp => {
          resp.resume()
          resp.on('error', reject)
          resp.on('end', resolve)
        },
      )
      request.on('timeout', () => {
        request.abort()
      })
      request.write(bodyLatest())
      request.end()
    })
  }
  return bodyLatest()
}

////////////////////////
// Trigger Interfaces //
////////////////////////

// AWS

/**
 * Pull interested details out of the AWS context to return to the caller
 */
const awsExtractContextDetails = context => ({
  functionName: context.functionName,
  functionVersion: context.functionVersion,
  invokedFunctionArn: context.invokedFunctionArn,
  awsRequestId: context.awsRequestId,
})

/**
 * Handler for AWS API Gateway.
 *
 * NOTE: LAMBDA_PROXY configuration is expected.
 */
module.exports.aws_https = async (event, context) => {
  const triggeredTime = Date.now()
  const body = await module.exports.handler({
    ...(event.queryStringParameters || {}),
    ...tryToParseJsonObj(event.body),
    ...awsExtractContextDetails(context),
    triggeredTime,
  })
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  }
}

/**
 * Handler for AWS SQS
 *
 * NOTE: A batch size of 1 is expected.
 */
module.exports.aws_pubsub = async (event, context) => {
  const triggeredTime = Date.now()
  const body = await module.exports.handler({
    ...JSON.parse(event.Records[0].body),
    ...awsExtractContextDetails(context),
    triggeredTime,
  })
  return
}
