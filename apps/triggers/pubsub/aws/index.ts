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

export const PUBSUB_BATCH_SIZE = 10

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

export default class PubsubFaasRunner implements IPubsubFaasRunner {
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
    await this.server.start()
  }

  /**
   *
   */
  async run(): Promise<IResult> {
    const MessageBody = JSON.stringify({
      webhook: `http://${this.context.triggerRunnerPublicIp}:${
        this.server.port
      }`,
      requestId: 'REPLACE_ID',
      ...this.params.faasParams,
    })
    const message = (id: string) => ({
      Id: id,
      MessageBody: MessageBody.replace('REPLACE_ID', id),
    })
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
          this.requests.set(i, {
            timeBeforeSdkCall,
            timeAfterSdkCall,
          })
        }
      }),
    )
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

  teardown(): Promise<void> {
    throw new Error('Method not implemented yet...')
  }
}
