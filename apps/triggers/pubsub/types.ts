import * as t from 'io-ts'
import { FaasParams } from '../../shared/types'
import { RunnerParams, IRunner } from '../shared'

export const PubsubFaasRunnerParams = t.exact(
  t.intersection([
    RunnerParams,
    t.type({
      numberOfMessages: t.number,
      faasParams: FaasParams,
    }),
  ]),
)
export type IPubsubFaasRunnerParams = t.TypeOf<typeof PubsubFaasRunnerParams>

export type IPubsubFaasRunnerTargets = {
  queue: string
}

export type IPubsubFaasRunner = IRunner<
  IPubsubFaasRunnerParams,
  IPubsubFaasRunnerTargets
>
