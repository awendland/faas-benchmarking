import * as fs from 'fs'
import * as Path from 'path'
import { Provider, IContext } from '../shared'
import { IOrchestratorConstructor, InfraType } from './shared'
import { decodeOrThrow } from '../shared/utils'

//////////////////
// Setup values //
//////////////////
const argv = require('minimist')(process.argv.slice(2))
const provider = decodeOrThrow(argv.provider, Provider)
const infraType = decodeOrThrow(argv.type, InfraType)
const orchestratorModule = require(Path.join(
  __dirname,
  provider,
  infraType,
  'orchestrator',
))
const orchestratorConstructor: IOrchestratorConstructor =
  orchestratorModule.default
const params = decodeOrThrow(
  Object.assign(
    {
      numberOfFunctions: 30,
      memorySize: '128',
      runtime: 'node8',
      sourceDir: __dirname + '/../faas',
      timeout: 30,
    },
    argv,
  ),
  orchestratorModule.ParamsType,
)

///////////////
// CLI Entry //
///////////////

const run = async () => {
  const orchestrator = new orchestratorConstructor(
    {
      projectName: `infra-${Date.now().toString(36)}`,
      provider: {
        name: provider,
        params: {
          region: 'us-east-1',
        },
      },
    } as IContext,
    params,
  )
  try {
    console.log(await orchestrator.setup())
  } catch (e) {
    if (e.stdout) {
      console.error(`Process exited with status=${e.code}`)
      console.error(e.stdout)
      console.error(e.stderr)
    } else {
      console.error(e)
    }
  }
  if (!argv.keep) {
    await orchestrator.teardown()
  }
}

if (require.main === module) {
  run().catch(e => {
    console.error(e)
    process.exit(1)
  })
}
