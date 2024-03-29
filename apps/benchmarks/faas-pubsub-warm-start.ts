import { IFaasSize, FaasSizes } from '../infrastructure/shared'
import { handleArgs, prepareContext } from './lib/shared'
import { runTrialBatch } from './lib/faas-pubsub-shared'

////////////////
// Warm Start //
////////////////

const run = async () => {
  const { argv, provider, OrchestratorModule } = handleArgs({
    processArgv: process.argv,
    infraType: 'faas-pubsub',
  })

  for (const memorySize of Object.keys(FaasSizes) as IFaasSize[]) {
    console.debug(`Testing pubsub-warm-start for ${memorySize} MB FaaS`)
    const context = await prepareContext({
      benchmarkType: 'pubsub-warm-start',
      memorySize,
      provider,
      argv,
    })
    for (let i = 0; i < (argv.loops || 1); i++) {
      await runTrialBatch({
        numberOfFunctions: 1,
        numberOfMessagesPerFn: 1000,
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
