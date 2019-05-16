import * as aws from 'aws-sdk'
import { IContext, IAwsContext, liftAwsContext } from '../../../shared/types'
import { IRunnerConstructor } from '../../shared/types'
import { IPubsubFaasRunner, IPubsubFaasRunnerParams, IPubsubFaasRunnerTargets } from '../types'

export default class PubsubFaasRunner implements IPubsubFaasRunner {
  public provider: IAwsContext
  public sqs: aws.SQS

  constructor(
    public context: IContext,
    public params: IPubsubFaasRunnerParams,
    public targets: IPubsubFaasRunnerTargets,
  ) {
    this.provider = liftAwsContext(this.constructor.name, this.context)
    aws.config.region = this.provider.params.region
    this.sqs = new aws.SQS({apiVersion: '2012-11-05'})
  }

  setup(): Promise<void> {
    throw new Error('Method not implemented yet...')
  }

  /**
   *
   */
  async run(): Promise<void> {
    await Promise.all(_.chunk(10, _.range(this.params.numberOfItems)).map(ii => {
      const startTime = Date.now()
      return await sqs.sendMessageBatch({
        QueueUrl: this.params.queue,
        Entries: [
        ]
      }).promise().then(r => {
        const endTime = Date.now()
        return r
      })
    }))
  }

  teardown(): Promise<void> {
    throw new Error('Method not implemented yet...')
  }
}
