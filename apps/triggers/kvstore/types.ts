import * as t from 'io-ts'
import { FaasParams } from '../../shared/types'
import { IRunner, BaseRunnerParams } from '../shared'

// Requester

export const KvstoreFaasRequesterParams = t.exact(BaseRunnerParams)
export type IKvstoreFaasRequesterParams = t.TypeOf<
  typeof KvstoreFaasRequesterParams
>

export const KvstoreFaasRequesterTargets = t.type({
  queue: t.string,
})
export type IKvstoreFaasRequesterTargets = t.TypeOf<
  typeof KvstoreFaasRequesterTargets
>

export type IKvstoreFaasRequester = {}

// Runner

export const KvstoreFaasRunnerParams = KvstoreFaasRequesterParams

export type IKvstoreFaasRunnerParams = t.TypeOf<typeof KvstoreFaasRunnerParams>

export const KvstoreFaasRunnerTargets = KvstoreFaasRequesterTargets
export type IKvstoreFaasRunnerTargets = t.TypeOf<
  typeof KvstoreFaasRunnerTargets
>

export type IKvstoreFaasRunner = IRunner<
  IKvstoreFaasRunnerParams,
  IKvstoreFaasRunnerTargets
>
