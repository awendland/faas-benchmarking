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
  IKvstoreFaasRunner,
  IKvstoreFaasRunnerParams,
  IKvstoreFaasRunnerTargets,
} from '../types'
import CallbackServer from '../../shared/callback-server'
import AwsKvstoreFaasRequester from './requester'

// TODO generic-ize this and share it w/ Kvstore runner as well (any
// runner that needs a Callback Server)

/**
 * Implementation of KvstoreFaasRunner for AWS.
 */
export default class AwsKvstoreFaasRunner implements IKvstoreFaasRunner {
  public provider: IAwsContext
  public server: CallbackServer
  public requester: AwsKvstoreFaasRequester

  constructor(
    public context: IContext,
    public params: IKvstoreFaasRunnerParams,
    public targets: IKvstoreFaasRunnerTargets,
  ) {
    this.provider = liftAwsContext(this.constructor.name, this.context)
    this.requester = new AwsKvstoreFaasRequester(
      this.context,
      this.params,
      this.targets,
    )
    this.server = new CallbackServer()
  }

  async setup(): Promise<void> {
    this.server.port = await getPort({ port: 3000 })
    console.debug(`Starting Callback Server on port=${this.server.port}`)
    await this.server.start()
    await this.requester.setup({
      webhook: `http://${this.context.triggerRunnerPublicIp}:${
        this.server.port
      }`,
    })
  }

  async run(): Promise<IResult> {
    const requests = await this.requester.run()
    const callbackTimeout = 5 * 60 * 1000
    await this.server.waitUntil({
      numRequests: requests.size,
      timeout: callbackTimeout,
    })
    await this.server.stop()
    const events: IResultEvent[] = this.server.requests.map(callbacks => {
      const faasData: IFaasResponse = JSON.parse(callbacks.rawData)
      return {
        startTime: requests.get(faasData.requestId!)!.timeBeforeSdkCall,
        endTime: callbacks.time,
        response: faasData,
      }
    })
    return {
      events,
    }
  }

  async teardown(): Promise<void> {
    await this.server.stop()
    await this.requester.teardown()
    /* noop */
  }
}
