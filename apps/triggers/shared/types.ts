import * as t from 'io-ts'
import { IContext } from '../../shared'

/////////////
// Runners //
/////////////

export type IRunner<Params, TargetInfra> = {
  setup(): Promise<void>
  run(): Promise<void>
  teardown(): Promise<void>
}

export type IRunnerConstructor<
  ProviderConfig = {},
  Params = {},
  TargetInfra = {}
> = {
  new (
    context: IContext,
    params: Params,
    targets: TargetInfra,
  ): IRunner<Params, TargetInfra>
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
