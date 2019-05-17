import * as aws from 'aws-sdk'
import * as _ from 'lodash'
import getPort from 'get-port'
import {
  IContext,
  IAwsContext,
  liftAwsContext,
  IFaasResponse,
} from '../../../shared/types'
import { IRunnerConstructor, IResult, IResultEvent } from '../../shared/types'
import {
  IPubsubFaasRunner,
  IPubsubFaasRunnerParams,
  IPubsubFaasRunnerTargets,
} from '../types'
import CallbackServer from '../../shared/callback-server'

///////////////////
// Magic Numbers //
///////////////////

export const PUBSUB_BATCH_SIZE = 10

//////////////////////
// Additional Types //
//////////////////////

export type IRequestId = string

export type IRequest = {
  /**
   * Recorded prior to calling the AWS SDK method.
   * ms from some stable epoch
   */
  timeBeforeSdkCall: number
  /**
   * Recorded after the AWS SDK method returns.
   * ms from some stable epoch
   */
  timeAfterSdkCall: number
}

/**
 * Implementation of PubsubFaasRunner for AWS.
 */
export default class AwsPubsubFaasRunner implements IPubsubFaasRunner {
  public provider: IAwsContext
  public sqs: aws.SQS
  public server: CallbackServer
  public requests = new Map<IRequestId, IRequest>()

  constructor(
    public context: IContext,
    public params: IPubsubFaasRunnerParams,
    public targets: IPubsubFaasRunnerTargets,
  ) {
    this.provider = liftAwsContext(this.constructor.name, this.context)
    aws.config.region = this.provider.params.region
    this.sqs = new aws.SQS({ apiVersion: '2012-11-05' })

    this.server = new CallbackServer()
  }

  async setup(): Promise<void> {
    this.server.port = await getPort({ port: 3000 })
    console.debug(`Starting Callback Server on port=${this.server.port}`)
    await this.server.start()
  }

  async run(): Promise<IResult> {
    const MessageBody = JSON.stringify({
      ...this.params.faasParams,
      webhook: `http://${this.context.triggerRunnerPublicIp}:${this.server.port}`,
      requestId: 'REPLACE_ID',
    })
    const message = (id: string) => ({
      Id: id,
      MessageBody: MessageBody.replace('REPLACE_ID', id),
    })
    console.debug(
      `Sending ${
        this.params.numberOfMessages
      } messages to SQS in batches of ${PUBSUB_BATCH_SIZE}`,
    )
    await Promise.all(
      _.chunk(
        _.range(this.params.numberOfMessages).map(i => String(i)),
        PUBSUB_BATCH_SIZE,
      ).map(async ii => {
        const timeBeforeSdkCall = Date.now()
        await this.sqs
          .sendMessageBatch({
            QueueUrl: this.targets.queue,
            Entries: ii.map(i => message(i)),
          })
          .promise()
        const timeAfterSdkCall = Date.now()
        for (const i of ii) {
          if (this.requests.has(i)) {
            console.warn(
              `Duplicate callbacks seen for request ${i}. The first will be used for analysis.`,
            )
          } else {
            this.requests.set(i, {
              timeBeforeSdkCall,
              timeAfterSdkCall,
            })
          }
        }
      }),
    )
    const callbackTimeout = 120 * 1000
    const didSeeRequests = await this.server.waitUntil({
      numRequests: this.params.numberOfMessages,
      timeout: callbackTimeout,
    })
    await this.server.stop()
    const events: IResultEvent[] = this.server.requests.map(callbacks => {
      const faasData: IFaasResponse = JSON.parse(callbacks.rawData)
      return {
        startTime: this.requests.get(faasData.requestId!)!.timeBeforeSdkCall,
        endTime: callbacks.time,
        response: faasData,
      }
    })
    return {
      events,
    }
  }

  async teardown(): Promise<void> {
    /* noop */
  }
}
