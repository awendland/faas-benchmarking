import * as fs from 'fs-extra'
import { promisify } from 'util'
import * as cp from 'child_process'
import * as Path from 'path'
import * as aws from 'aws-sdk'
import * as t from 'io-ts'
import * as _ from 'lodash'
import { dir as createtmpdir, DirectoryResult } from 'tmp-promise'
import { IContext } from '../../../shared/types'
import { serverlessBin } from '../shared'
import { translateToAws, prepareHandlerCodeZip } from '../faas'
import {
  IPubsubFaasOrchestrator,
  PubsubFaasOrchestratorParams,
  IPubsubFaasOrchestratorParams,
} from '../../shared'
import { decodeOrThrow } from '../../../shared/utils'

const execFile = promisify(cp.execFile)

/*
 * So that this module conforms to:
 * {
 *  default: IOrchestratorConstructor,
 *  ParamsType: typeof default.params,
 * }
 */
export const ParamsType = PubsubFaasOrchestratorParams

/**
 *
 */
export default class AwsPubsubFaasOrchestrator
  implements IPubsubFaasOrchestrator {
  private tmpdir: DirectoryResult | null = null
  public sqs: aws.SQS

  /**
   * NOTE: Due to CloudFormation's resource limit of 200, there is a cap of
   * ~30 functions that can be created at once
   */
  constructor(
    public context: IContext,
    public params: IPubsubFaasOrchestratorParams,
  ) {
    if (this.context.provider.name !== 'aws') {
      throw new Error(
        `${this.constructor.name} was provided a context for ${
          this.context.provider.name
        }`,
      )
    }
    decodeOrThrow(this.params, PubsubFaasOrchestratorParams)
    aws.config.region = this.context.provider.params.region
    this.sqs = new aws.SQS({ apiVersion: '2012-11-05' })
  }

  /**
   * NOTE: creating 30 functions takes ~100 seconds.
   */
  async setup() {
    const startTime = Date.now()
    const queuePrefix = `${this.context.projectName}Queue`
    this.tmpdir = await createtmpdir({
      prefix: 'faas-pubsub-aws-',
      unsafeCleanup: true,
    })
    console.info(`Working in ${this.tmpdir.path}`)

    const packageZip = Path.join(this.tmpdir.path, 'faas.zip')
    await prepareHandlerCodeZip(Path.resolve(this.params.sourceDir), packageZip)

    // TODO multiple queues

    const serverlessYaml = `
service: ${this.context.projectName}
provider:
  name: aws
  runtime: ${translateToAws.runtime(this.params.runtime)}
  stackName: ${this.context.projectName}
  apiName: ${this.context.projectName}
package:
  artifact: ${packageZip}
functions:
${_.range(this.params.numberOfFunctions)
  .map(
    i => `
  fn${i}:
    handler: index.${this.context.provider.name}_pubsub
    memorySize: ${this.params.memorySize}
    timeout: ${this.params.timeout}
    events:
      - sqs:
          batchSize: 1
          arn:
            Fn::GetAtt:
              - Queue${i}
              - Arn`,
  )
  .join('')}
resources:
  Resources:
${_.range(this.params.numberOfFunctions)
  .map(
    i => `
    Queue${i}:
      Type: "AWS::SQS::Queue"
      Properties:
        QueueName: "${queuePrefix}${i}"`,
  )
  .join('')}
`
    await fs.writeFile(
      Path.join(this.tmpdir.path, 'serverless.yml'),
      serverlessYaml,
    )

    console.debug(`Running ${serverlessBin} deploy`)
    const { stdout } = await execFile(
      serverlessBin,
      [`--region=${this.context.provider.params.region}`, `deploy`],
      {
        cwd: this.tmpdir.path,
        maxBuffer: 50 * 1024 * 1024, // Max amount of bytes allowed on stdout and stderr
      },
    )
    console.debug(stdout)
    console.debug(`Setup in ${(Date.now() - startTime) / 1000} sec`)
    console.debug(`Retrieving SQS Queue URLs`)
    const listQueueData = await this.sqs
      .listQueues({ QueueNamePrefix: queuePrefix })
      .promise()
    if (!listQueueData || !listQueueData.QueueUrls) {
      throw new Error(`Unable to retrieve queues`)
    }
    const queues = listQueueData.QueueUrls
    console.debug(`Queues:\n${queues.map(q => `  ${q}`).join('\n')}`)
    return { queues }
  }

  async teardown() {
    if (this.tmpdir) {
      console.debug(`Running ${serverlessBin} remove`)
      const startTime = Date.now()
      const { stdout } = await execFile(serverlessBin, [`remove`], {
        cwd: this.tmpdir.path,
      })
      console.debug(stdout)
      await this.tmpdir.cleanup()
      console.debug(`Teardown in ${(Date.now() - startTime) / 1000} sec`)
    }
  }
}
