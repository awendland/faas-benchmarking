export type Orchestrator<Provider, Config, NotableInfra> = {
  setup(): Promise<NotableInfra>
  teardown(): Promise<void>
}

export type OrchestratorConstructor<Provider, Config, NotableInfra> = {
  new (provider: Provider, config: Config): Orchestrator<
    Provider,
    Config,
    NotableInfra
  >
}

export type BaseConfig = {
  projectName: string
}

export type FaasSize = '128' | '256' | '512' | '1024' | '2048'
export type FaasRuntime = 'node8'

export type BaseFaasConfig = BaseConfig & {
  numberOfFunctions: number
  memorySize: FaasSize
  runtime: FaasRuntime
  sourceDir: string
  timeout: number
}

// HTTPS FaaS

export type HttpsFaasOrchestratorConfig = BaseFaasConfig

export type HttpsFaasOrchestratorInfra = {
  urls: string[]
}

export type HttpsFaasOrchestrator<Provider> = Orchestrator<
  Provider,
  HttpsFaasOrchestratorConfig,
  HttpsFaasOrchestratorInfra
>

// Pub/Sub FaaS

export type PubsubFaasOrchestratorConfig = BaseFaasConfig

export type PubsubFaasOrchestratorInfra = {
  urls: string[]
}

export type PubsubFaasOrchestrator<Provider> = Orchestrator<
  Provider,
  HttpsFaasOrchestratorConfig,
  HttpsFaasOrchestratorInfra
>
