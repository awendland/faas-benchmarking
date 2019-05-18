import { IContext } from '../shared'
import {
  IFaasSize,
  IOrchestrator,
  IOrchestratorModule,
} from '../infrastructure/shared'
import { decodeOrThrow, tryThenTeardown } from '../shared/utils'
import { appendResultFile } from './shared'
import {
  msgPerSecToPeriod,
  IRunnerConstructor,
  IBaseRunnerParams,
} from '../triggers/shared'

/**
 * Creates a functions for running benchmarls for any trigger type.
 *
 * Run a batch of pubsub tests. The only limit to batch size is the number
 * of resources that can be created in a given CloudFormation (expressed
 * indirectly as numberOfFunctions).
 */
export const runTrialBatchGen = <O extends IOrchestrator, Infra, Target>({
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
      sourceDir: __dirname + '/../faas',
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
