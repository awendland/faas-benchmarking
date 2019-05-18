import * as t from 'io-ts'
import { FaasParams } from '../../shared/types'
import { IRunner, BaseRunnerParams } from '../shared'

// Runner

export const HttpsRunnerParams = t.exact(BaseRunnerParams)

export type IHttpsRunnerParams = t.TypeOf<typeof HttpsRunnerParams>

export const HttpsRunnerTargets = t.type({
  url: t.string,
})
export type IHttpsRunnerTargets = t.TypeOf<typeof HttpsRunnerTargets>

export type IHttpsRunner = IRunner<IHttpsRunnerParams, IHttpsRunnerTargets>
