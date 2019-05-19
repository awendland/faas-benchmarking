import { IContext } from '../../shared'
import {
  IFaasSize,
  IPubsubFaasOrchestrator,
  FaasSizes,
  IOrchestratorModule,
} from '../../infrastructure/shared'
import { decodeOrThrow, tryThenTeardown } from '../../shared/utils'
import PubsubFaasRunner from '../../triggers/pubsub/runner'
import { appendResultFile } from './shared'
import { msgPerSecToPeriod } from '../../triggers/shared'

type StaticOrDynamicBatch =
  | {
      numberOfMessagesPerFn: number
    }
  | {
      initialMsgPerSec: number
      incrementMsgPerSec?: number | undefined
      incrementPeriod?: number | undefined
      numberOfPeriods?: number | undefined
    }

/**
 * Run a batch of pubsub tests. The only limit to batch size is the number
 * of resources that can be created in a given CloudFormation (expressed
 * indirectly as numberOfFunctions).
 */
export const runTrialBatch = async ({
  context,
  memorySize,
  numberOfFunctions,
  functionSleep,
  OrchestratorModule,
  ...args
}: {
  context: IContext
  memorySize: IFaasSize
  numberOfFunctions: number
  functionSleep?: number | undefined
  OrchestratorModule: IOrchestratorModule
} & StaticOrDynamicBatch) => {
  const {
    numberOfMessagesPerFn,
    initialMsgPerSec,
    incrementMsgPerSec,
    incrementPeriod,
    numberOfPeriods,
  } = args as any
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
  const orchestrator = new OrchestratorModule.default(
    context,
    params,
  ) as IPubsubFaasOrchestrator
  await tryThenTeardown(orchestrator, async () => {
    const targets = await orchestrator.setup()
    for (const queue of targets.queues) {
      const triggerParams = {
        initialMsgPerSec: initialMsgPerSec || numberOfMessagesPerFn,
        incrementMsgPerSec: incrementMsgPerSec || 0,
        incrementPeriod: incrementPeriod || 0,
        numberOfPeriods: numberOfPeriods || 1,
        faasParams: { sleep: functionSleep } as any,
      }
      const trigger = new PubsubFaasRunner(context, triggerParams, { queue })
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
