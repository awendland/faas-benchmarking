import * as t from 'io-ts'
import { FaasResponse, IContext } from '../../shared'

/////////////
// Runners //
/////////////

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
})
export type IResultEvent = t.TypeOf<typeof ResultEvent>

export const Result = t.type({
  events: t.array(ResultEvent),
})
export type IResult = t.TypeOf<typeof Result>

export type IRunner<Params, TargetInfra> = {
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

export const RunnerParams = t.type({
  duration: t.number,
})
export type IRunnerParams = t.TypeOf<typeof RunnerParams>

// HTTPS FaaS

export const HttpsFaasRunnerParams = t.exact(RunnerParams)
export type IHttpsFaasRunnerParams = t.TypeOf<typeof HttpsFaasRunnerParams>

export type IHttpsFaasRunnerTargets = {
  url: string
}

export type IHttpsFaasRunner = IRunner<
  IHttpsFaasRunnerParams,
  IHttpsFaasRunnerTargets
>
