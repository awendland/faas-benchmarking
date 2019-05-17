import * as fs from 'fs-extra'
import * as Path from 'path'
import minimist from 'minimist'
import publicIp from 'public-ip'
import {
  InfraType,
  IInfraType,
  IOrchestratorConstructor,
} from '../infrastructure/shared'
import { decodeOrThrow } from '../shared/utils'
import { Provider, IProvider, IContext, Context } from '../shared'

/**
 * Parse arguments to produce relevant constructors, values, and other useful
 * information for the benchmark
 */
export const handleArgs = ({
  processArgv,
  infraType,
}: {
  processArgv: any
  infraType: IInfraType
}) => {
  const argv = minimist(processArgv.slice(2))

  const provider = decodeOrThrow(argv.provider, Provider)
  const orchestratorModule = require('./' +
    Path.join('../infrastructure', provider, infraType, 'orchestrator'))
  const Orchestrator: IOrchestratorConstructor = orchestratorModule.default

  return {
    argv,
    provider,
    Orchestrator,
    OrchestratorParamsType: orchestratorModule.ParamsType,
  }
}

/**
 * Prepare a Context object for the given benchmark
 */
export const prepareContext = async ({
  benchmarkType,
  provider,
  argv,
}: {
  benchmarkType: string
  provider: IProvider
  argv: any
}) => {
  return decodeOrThrow(
    {
      projectName: `${benchmarkType}-${Date.now().toString(36)}`,
      triggerRunnerPublicIp:
        argv.triggerRunnerPublicIp || (await publicIp.v4()),
      provider: {
        name: provider,
        params: {
          region: argv.region || 'us-east-1',
        },
      },
    },
    Context,
  )
}

/**
 * Append results data to an output file in JSON new line format
 */
export const appendResultFile = async (file: string, data: any) => {
  fs.appendFile(
    file,
    JSON.stringify({ time: new Date().toISOString(), data }) + '\n',
  )
}
