import * as t from 'io-ts'
import { FaasParams } from '../../shared/types'
import { IRunner } from '../shared'

export const PubsubFaasRunnerParams = t.exact(
  t.type({
    numberOfMessages: t.number,
    faasParams: FaasParams,
  }),
)
export type IPubsubFaasRunnerParams = t.TypeOf<typeof PubsubFaasRunnerParams>

export const PubsubFaasRunnerTargets = t.type({
  queue: t.string,
})
export type IPubsubFaasRunnerTargets = t.TypeOf<typeof PubsubFaasRunnerTargets>

export type IPubsubFaasRunner = IRunner<
  IPubsubFaasRunnerParams,
  IPubsubFaasRunnerTargets
>
