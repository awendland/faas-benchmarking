import { IFaasSize, FaasSizes } from '../infrastructure/shared'
import { handleArgs, prepareContext } from './shared'
import { runTrialBatch } from './faas-pubsub-shared'

////////////////
// Cold Start //
////////////////

const run = async () => {
  const { argv, provider, OrchestratorModule } = handleArgs({
    processArgv: process.argv,
    infraType: 'faas-pubsub',
  })

  for (const memorySize of Object.keys(FaasSizes) as IFaasSize[]) {
    console.debug(`Testing pubsub-cold-start for ${memorySize} MB FaaS`)
    const context = await prepareContext({
      benchmarkType: 'pubsub-cold-start',
      memorySize,
      provider,
      argv,
    })
    for (let i = 0; i < (argv.loops || 1); i++) {
      await runTrialBatch({
        // Cloudformation max is 200 resources which is ~10 pubsub fns
        numberOfFunctions: 30,
        numberOfMessagesPerFn: 1,
        memorySize: memorySize,
        functionSleep: argv.functionSleep,
        context,
        OrchestratorModule,
      }).catch(console.error)
    }
  }
}

if (require.main === module) {
  run().catch(e => {
    console.error(e)
    process.exit(1)
  })
}
