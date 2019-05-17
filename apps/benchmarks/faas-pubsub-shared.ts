import { IContext } from '../shared'
import {
  IFaasSize,
  IPubsubFaasOrchestrator,
  FaasSizes,
  IOrchestratorModule,
} from '../infrastructure/shared'
import { decodeOrThrow, tryThenTeardown } from '../shared/utils'
import PubsubFaasRunner from '../triggers/pubsub/runner'
import { appendResultFile } from './shared'

/**
 * Run a batch of pubsub tests. The only limit to batch size is the number
 * of resources that can be created in a given CloudFormation (expressed
 * indirectly as numberOfFunctions).
 */
export const runTrialBatch = async ({
  context,
  memorySize,
  numberOfFunctions,
  numberOfMessagesPerFn,
  OrchestratorModule,
}: {
  context: IContext
  memorySize: IFaasSize
  numberOfFunctions: number
  numberOfMessagesPerFn: number
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
  const orchestrator = new OrchestratorModule.default(
    context,
    params,
  ) as IPubsubFaasOrchestrator
  await tryThenTeardown(orchestrator, async () => {
    const targets = await orchestrator.setup()
    for (const queue of targets.queues) {
      const trigger = new PubsubFaasRunner(
        context,
        {
          numberOfMessages: numberOfMessagesPerFn,
          faasParams: {} as any,
        },
        { queue },
      )
      await tryThenTeardown(trigger, async () => {
        await trigger.setup()
        const results = await trigger.run()
        await appendResultFile(context.projectName, { memorySize, results })
      })
    }
  }).catch(console.error)
}
