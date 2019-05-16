import * as t from 'io-ts'
import { IContext } from '../../shared'

///////////////////
// Orchestrators //
///////////////////

export type IOrchestrator<Params, NotableInfra> = {
  setup(): Promise<NotableInfra>
  teardown(): Promise<void>
}

export type IOrchestratorConstructor<
  ProviderConfig = {},
  Params = {},
  NotableInfra = {}
> = {
  new (context: IContext, params: Params): IOrchestrator<
    Params,
    NotableInfra
  >
}

export const InfraType = t.keyof({
  'faas-https': null,
  'faas-pubsub': null,
})
export type IInfraType = t.TypeOf<typeof InfraType>

export const FaasSize = t.keyof({
  '128': null,
  '256': null,
  '512': null,
  '1024': null,
  '2048': null,
})
export type IFaasSize = t.TypeOf<typeof FaasSize>

export const FaasRuntime = t.keyof({
  node8: null,
})
export type IFaasRuntime = t.TypeOf<typeof FaasRuntime>

export const BaseFaasParams = t.type({
  numberOfFunctions: t.number,
  memorySize: FaasSize,
  runtime: FaasRuntime,
  sourceDir: t.string,
  timeout: t.number,
})

// HTTPS FaaS

export const HttpsFaasOrchestratorParams = t.exact(BaseFaasParams)
export type IHttpsFaasOrchestratorParams = t.TypeOf<typeof HttpsFaasOrchestratorParams>

export type IHttpsFaasOrchestratorInfra = {
  urls: string[]
}

export type IHttpsFaasOrchestrator = IOrchestrator<
  t.TypeOf<typeof HttpsFaasOrchestratorParams>,
  IHttpsFaasOrchestratorInfra
>

// Pub/Sub FaaS

export const PubsubFaasOrchestratorParams = t.exact(BaseFaasParams)
export type IPubsubFaasOrchestratorParams = t.TypeOf<typeof PubsubFaasOrchestratorParams>

export type IPubsubFaasOrchestratorInfra = {
  urls: string[]
}

export type IPubsubFaasOrchestrator = IOrchestrator<
  t.TypeOf<typeof HttpsFaasOrchestratorParams>,
  IHttpsFaasOrchestratorInfra
>
