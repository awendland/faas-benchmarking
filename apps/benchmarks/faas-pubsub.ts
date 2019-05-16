import * as fs from 'fs'
import * as Path from 'path'
import { Provider, IContext } from '../shared'
import {
  InfraType,
  IOrchestratorConstructor,
  IFaasSize,
  IHttpsFaasOrchestrator,
  IPubsubFaasOrchestrator,
} from '../infrastructure/shared'
import { decodeOrThrow } from '../shared/utils'
import PubsubFaasRunner from '../triggers/pubsub/runner'
import { testAppendFile } from './shared'

//////////////////
// Setup values //
//////////////////
// Parse inputs
const argv = require('minimist')(process.argv.slice(2))
const provider = decodeOrThrow(argv.provider, Provider)
const orchestratorModule = require('./' +
  Path.join('../infrastructure', provider, 'faas-pubsub', 'orchestrator'))
const orchestratorConstructor: IOrchestratorConstructor =
  orchestratorModule.default

///////////////
// Run Trial //
///////////////
const runTrial = async (context: IContext, memorySize: IFaasSize) => {
  const params = decodeOrThrow(
    {
      numberOfFunctions: 30, // Cloudformation max, perf optimization
      memorySize,
      runtime: 'node8',
      sourceDir: __dirname + '/../faas',
      timeout: 30,
    },
    orchestratorModule.ParamsType,
  )
  const orchestrator = new orchestratorConstructor(
    context,
    params,
  ) as IPubsubFaasOrchestrator
  try {
    const targets = await orchestrator.setup()
    for (const queue in targets.queues) {
      const trigger = new PubsubFaasRunner(
        context,
        {
          numberOfMessages: 1,
        },
        { queue },
      )
      await trigger.setup()
      const results = await trigger.run()
      await testAppendFile(context.projectName, results)
      // Handle results
      await trigger.teardown()
    }
  } catch (e) {
    await orchestrator.teardown()
    throw e
  }
}

///////////////
// CLI Entry //
///////////////

const run = async () => {
  const context = {
    projectName: `cold-start-${Date.now().toString(36)}`,
    triggerRunnerPublicIp: argv.triggerRunnerPublicIp,
    provider: {
      name: provider,
      params: {
        region: 'us-east-1',
      },
    },
  }
  await runTrial(context, '128')
}

if (require.main === module) {
  run().catch(e => {
    console.error(e)
    process.exit(1)
  })
}
