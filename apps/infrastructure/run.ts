import * as fs from 'fs'
import * as Path from 'path'
import { Provider } from '../shared'
import { decodeOrThrow, InfraType, IOrchestratorConstructor } from './shared'

//////////////////
// Setup values //
//////////////////
const argv = require('minimist')(process.argv.slice(2))
const provider = decodeOrThrow(argv.provider, Provider)
const infraType = decodeOrThrow(argv.type, InfraType)
const orchestratorConstructor: IOrchestratorConstructor = require('./' +
  Path.join('.', provider, infraType, 'orchestrator')).default

///////////////
// CLI Entry //
///////////////

if (require.main === module) {
  ;(async () => {
    const orchestrator = new orchestratorConstructor(
      Object.assign(
        {
          region: 'us-east-1',
        },
        argv,
      ),
      Object.assign(
        {
          projectName: `test-${Date.now().toString(36)}`,
          numberOfFunctions: 30,
          memorySize: '128',
          runtime: 'node8',
          sourceDir: '../../../faas',
          timeout: 30,
        },
        argv,
      ),
    )
    try {
      console.log(await orchestrator.setup())
    } catch (e) {
      await orchestrator.teardown()
      throw e
    }
  })().catch(async e => {
    console.error(e)
    process.exit(1)
  })
}
