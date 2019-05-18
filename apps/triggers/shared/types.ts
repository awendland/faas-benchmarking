import * as t from 'io-ts'
import { FaasResponse, IContext, FaasParams } from '../../shared'

export const TriggerType = t.keyof({
  https: null,
  pubsub: null,
  kvstore: null,
})
export type ITriggerType = t.TypeOf<typeof TriggerType>

/////////////
// Runners //
/////////////

export const BaseRunnerParams = t.type({
  initialMsgPerSec: t.number,
  incrementMsgPerSec: t.union([t.number, t.undefined]),
  incrementPeriod: t.union([t.number, t.undefined]),
  numberOfPeriods: t.number,
  faasParams: FaasParams,
})
export type IBaseRunnerParams = t.TypeOf<typeof BaseRunnerParams>

export type IRunnerModule = {
  default: IRunnerConstructor
  ParamsType: t.Type<any, any, any>
  TargetsType: t.Type<any, any, any>
}

export const ResultEvent = t.type({
  /**
   * ms from some epoch (epoch is stable for all events in a run)
   */
  startTime: t.number,
  /**
   * ms from some epoch (epoch is stable for all events in a run)
   */
  endTime: t.number,
  /**
   * Response received from the FaaS, parsed as JSON
   */
  response: FaasResponse,
  /**
   * Response received that wasn't valid FaaS JSON
   */
  invalidResponse: t.union([t.string, t.undefined]),
})
export type IResultEvent = t.TypeOf<typeof ResultEvent>

export const Result = t.type({
  events: t.array(ResultEvent),
})
export type IResult = t.TypeOf<typeof Result>

export type IRunner<Params = {}, TargetInfra = {}> = {
  setup(): Promise<void>
  run(): Promise<IResult>
  teardown(): Promise<void>
}

export type IRunnerConstructor<
  ProviderConfig = {},
  Params = {},
  TargetInfra = {}
> = {
  new (context: IContext, params: Params, targets: TargetInfra): IRunner<
    Params,
    TargetInfra
  >
}
