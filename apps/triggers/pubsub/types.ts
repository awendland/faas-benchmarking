import * as t from 'io-ts'
import { RunnerParams, IRunner } from '../shared'

export const PubsubFaasRunnerParams = t.exact(RunnerParams)
export type IPubsubFaasRunnerParams = t.TypeOf<typeof PubsubFaasRunnerParams>

export type IPubsubFaasRunnerTargets = {
  queue: string
}

export type IPubsubFaasRunner = IRunner<
  IPubsubFaasRunnerParams,
  IPubsubFaasRunnerTargets
>
