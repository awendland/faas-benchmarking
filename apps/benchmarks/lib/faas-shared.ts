import { IContext } from '../../shared'
import {
  IFaasSize,
  IOrchestrator,
  IOrchestratorModule,
  FaasSizes,
  IInfraType,
} from '../../infrastructure/shared'
import { decodeOrThrow, tryThenTeardown } from '../../shared/utils'
import { appendResultFile, handleArgs, prepareContext } from './shared'
import {
  msgPerSecToPeriod,
  IRunnerConstructor,
  IBaseRunnerParams,
} from '../../triggers/shared'

/**
 * Create a function to run a benchmark (appropriately typed for
 * the given provider, infrastructure, and trigger).
 */
export const createBenchmarkSuiteForInfra = ({
  benchmarkRunner,
  infraType,
}: {
  benchmarkRunner: ReturnType<typeof createBenchmarkRunnerForInfra>
  infraType: IInfraType
}) => async ({
  benchmarkName,
  numberOfFunctions,
  initialMsgPerSec,
  incrementMsgPerSec,
  incrementPeriod,
  numberOfPeriods,
  functionSleep,
}: {
  benchmarkName: string
  numberOfFunctions: number
  initialMsgPerSec: number
  incrementMsgPerSec?: number | undefined
  incrementPeriod?: number | undefined
  numberOfPeriods?: number | undefined
  functionSleep?: number | undefined
}) => {
  const { argv, provider, OrchestratorModule } = handleArgs({
    processArgv: process.argv,
    infraType: infraType,
  })

  for (const memorySize of Object.keys(FaasSizes) as IFaasSize[]) {
    console.debug(`Testing https-${benchmarkName} for ${memorySize} MB FaaS`)
    const context = await prepareContext({
      benchmarkType: `${infraType.replace('faas-', '')}-${benchmarkName}`,
      memorySize,
      provider,
      argv,
    })
    for (let i = 0; i < (argv.loops || 1); i++) {
      await benchmarkRunner({
        numberOfFunctions: numberOfFunctions || argv.numberOfFunctions,
        initialMsgPerSec,
        incrementMsgPerSec,
        incrementPeriod,
        numberOfPeriods,
        functionSleep: argv.functionSleep || functionSleep,
        memorySize: memorySize,
        context,
        OrchestratorModule,
      }).catch(console.error)
    }
  }
}

/**
 * Creates a functions for running benchmarls for any trigger type.
 *
 * Run a batch of pubsub tests. The only limit to batch size is the number
 * of resources that can be created in a given CloudFormation (expressed
 * indirectly as numberOfFunctions).
 */
export const createBenchmarkRunnerForInfra = <
  O extends IOrchestrator,
  Infra,
  Target
>({
  targetIterator,
  Runner,
}: {
  targetIterator: (infra: Infra) => Iterable<Target>
  Runner: IRunnerConstructor<{}, IBaseRunnerParams, Target>
}) => async ({
  context,
  memorySize,
  numberOfFunctions,
  initialMsgPerSec,
  incrementMsgPerSec,
  incrementPeriod,
  numberOfPeriods,
  functionSleep,
  OrchestratorModule,
  ...args
}: {
  context: IContext
  memorySize: IFaasSize
  numberOfFunctions: number
  initialMsgPerSec: number
  incrementMsgPerSec?: number | undefined
  incrementPeriod?: number | undefined
  numberOfPeriods?: number | undefined
  functionSleep?: number | undefined
  OrchestratorModule: IOrchestratorModule
}) => {
  const params = decodeOrThrow(
    {
      numberOfFunctions,
      memorySize,
      runtime: 'node8',
      sourceDir: __dirname + '/../../faas',
      timeout: 30,
    },
    OrchestratorModule.ParamsType,
  )
  const orchestrator = new OrchestratorModule.default(context, params) as O
  await tryThenTeardown(orchestrator, async () => {
    const targets = (await orchestrator.setup()) as Infra
    for (const target of targetIterator(targets)) {
      const triggerParams = {
        initialMsgPerSec: initialMsgPerSec,
        incrementMsgPerSec: incrementMsgPerSec || 0,
        incrementPeriod: incrementPeriod || 0,
        numberOfPeriods: numberOfPeriods || 1,
        faasParams: { sleep: functionSleep } as any,
      }
      const trigger = new Runner(context, triggerParams, target)
      await tryThenTeardown(trigger, async () => {
        await trigger.setup()
        const results = await trigger.run()
        await appendResultFile(context.projectName, {
          memorySize,
          results,
          initRate: msgPerSecToPeriod(
            triggerParams.incrementPeriod,
            triggerParams.initialMsgPerSec,
          ),
          incrementSize: msgPerSecToPeriod(
            triggerParams.incrementPeriod,
            triggerParams.incrementMsgPerSec,
          ),
          incrementPeriod: triggerParams.incrementPeriod,
        })
      })
    }
  }).catch(console.error)
}
