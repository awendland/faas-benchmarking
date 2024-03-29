import * as aws from 'aws-sdk'
import * as _ from 'lodash'
import getPort from 'get-port'
import { IContext, IAwsContext, liftAwsContext } from '../../../shared/types'
import {
  IPubsubFaasRequesterParams,
  IPubsubFaasRequesterTargets,
} from '../types'
import { sleep } from '../../../shared/utils'
import { msgPerSecToPeriod } from '../../shared'

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
export default class AwsPubsubFaasRequester {
  public provider: IAwsContext
  public sqs: aws.SQS
  private messageBody: string | undefined

  constructor(
    public context: IContext,
    public params: IPubsubFaasRequesterParams,
    public targets: IPubsubFaasRequesterTargets,
  ) {
    this.provider = liftAwsContext(this.constructor.name, this.context)
    aws.config.region = this.provider.params.region
    this.sqs = new aws.SQS({ apiVersion: '2012-11-05' })
  }

  async setup(messageBodyProps: {} = {}): Promise<void> {
    this.messageBody = JSON.stringify({
      ...this.params.faasParams,
      requestId: 'REPLACE_ID',
      ...messageBodyProps,
    })
  }

  private createMessage(id: string): aws.SQS.SendMessageBatchRequestEntry {
    if (!this.messageBody) {
      throw new TypeError(
        `setup() must be called before AwsPubsubFaasRequester can be used`,
      )
    }
    return {
      Id: id,
      MessageBody: this.messageBody.replace('REPLACE_ID', id),
    }
  }

  async send(numberOfMessages: number, idStart = 0) {
    const requests = new Map<IRequestId, IRequest>()
    await Promise.all(
      _.chunk(
        _.range(numberOfMessages).map(i => String(idStart + i)),
        PUBSUB_BATCH_SIZE,
      ).map(async ii => {
        const timeBeforeSdkCall = Date.now()
        await this.sqs
          .sendMessageBatch({
            QueueUrl: this.targets.queue,
            Entries: ii.map(i => this.createMessage(i)),
          })
          .promise()
        const timeAfterSdkCall = Date.now()
        for (const i of ii) {
          requests.set(i, {
            timeBeforeSdkCall,
            timeAfterSdkCall,
          })
        }
      }),
    )
    return requests
  }

  async run(): Promise<Map<IRequestId, IRequest>> {
    let periodReqCount = msgPerSecToPeriod(
      this.params.incrementPeriod,
      this.params.initialMsgPerSec,
    )
    const requests = new Map<IRequestId, IRequest>()

    for (let period = 0; period < this.params.numberOfPeriods; ++period) {
      const periodStart = Date.now()
      console.debug(
        `Sending ${periodReqCount} messages in batches of ${PUBSUB_BATCH_SIZE} to ${
          this.targets.queue
        }`,
      )
      const periodRequests = await this.send(periodReqCount, requests.size)
      for (const [k, v] of periodRequests.entries()) requests.set(k, v)
      if (this.params.incrementPeriod) {
        periodReqCount += msgPerSecToPeriod(
          this.params.incrementPeriod,
          this.params.incrementMsgPerSec,
        )
        const sleepTime =
          this.params.incrementPeriod - (Date.now() - periodStart)
        await sleep(sleepTime) // TODO this could lead to drift over time
      }
    }

    return requests
  }

  async teardown(): Promise<void> {
    /* noop */
  }
}
