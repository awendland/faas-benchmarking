import { IHttpsFaasOrchestratorInfra } from '../../infrastructure/shared'
import {
  createBenchmarkRunnerForInfra,
  createBenchmarkSuiteForInfra,
} from './faas-shared'
import HttpsRunner from '../../triggers/https/runner'

export const benchmarkRunner = createBenchmarkRunnerForInfra({
  targetIterator: (infra: IHttpsFaasOrchestratorInfra) =>
    infra.urls.map(url => ({ url })),
  Runner: HttpsRunner,
})

export const createHttpsBenchmark = createBenchmarkSuiteForInfra({
  benchmarkRunner,
  infraType: 'faas-https',
})
