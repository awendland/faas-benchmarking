import {
  IFaasSize,
  FaasSizes,
  IHttpsFaasOrchestratorInfra,
} from '../infrastructure/shared'
import { handleArgs, prepareContext } from './shared'
import { runTrialBatchGen } from './faas-shared'
import HttpsRunner from '../triggers/https/runner'

///////////////////
// Warm Constant //
///////////////////

export const runTrialBatch = runTrialBatchGen({
  targetIterator: (infra: IHttpsFaasOrchestratorInfra) =>
    infra.urls.map(url => ({ url })),
  Runner: HttpsRunner,
})

export const run = async () => {
  const { argv, provider, OrchestratorModule } = handleArgs({
    processArgv: process.argv,
    infraType: 'faas-https',
  })

  for (const memorySize of Object.keys(FaasSizes) as IFaasSize[]) {
    console.debug(`Testing https-warm-constant for ${memorySize} MB FaaS`)
    const context = await prepareContext({
      benchmarkType: 'https-warm-constant',
      memorySize,
      provider,
      argv,
    })
    for (let i = 0; i < (argv.loops || 1); i++) {
      await runTrialBatch({
        // Cloudformation max is 200 resources which is ~10 https fns
        numberOfFunctions: 1,
        initialMsgPerSec: 50,
        incrementMsgPerSec: 0,
        incrementPeriod: 10 * 1e3,
        numberOfPeriods: 20,
        memorySize: memorySize,
        functionSleep: argv.functionSleep || 5000,
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
