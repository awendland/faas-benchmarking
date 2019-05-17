import * as t from 'io-ts'
import { FaasParams } from '../../shared/types'
import { IRunner } from '../shared'

// Requester

export const PubsubFaasRequesterParams = t.exact(
  t.type({
    initialMsgPerSec: t.number,
    incrementMsgPerSec: t.union([t.number, t.undefined]),
    incrementPeriod: t.union([t.number, t.undefined]),
    duration: t.union([t.number, t.undefined]),
    faasParams: FaasParams,
  }),
)
export type IPubsubFaasRequesterParams = t.TypeOf<typeof PubsubFaasRequesterParams>

export const PubsubFaasRequesterTargets = t.type({
  queue: t.string,
})
export type IPubsubFaasRequesterTargets = t.TypeOf<typeof PubsubFaasRequesterTargets>

export type IPubsubFaasRequester = {}

// Runner

export const PubsubFaasRunnerParams = PubsubFaasRequesterParams

export type IPubsubFaasRunnerParams = t.TypeOf<typeof PubsubFaasRunnerParams>

export const PubsubFaasRunnerTargets = PubsubFaasRequesterTargets
export type IPubsubFaasRunnerTargets = t.TypeOf<typeof PubsubFaasRunnerTargets>

export type IPubsubFaasRunner = IRunner<
  IPubsubFaasRunnerParams,
  IPubsubFaasRunnerTargets
>
