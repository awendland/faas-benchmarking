import * as fs from 'fs'
import * as Path from 'path'
import { Provider, IContext } from '../shared'
import {
  IRunner,
  IRunnerConstructor,
  IRunnerModule,
  TriggerType,
} from './shared'
import { decodeOrThrow } from '../shared/utils'

//////////////////
// Setup values //
//////////////////
const argv = require('minimist')(process.argv.slice(2))
const provider = decodeOrThrow(argv.provider, Provider)
const triggerType = decodeOrThrow(argv.type, TriggerType)
const runnerModule: IRunnerModule = require(Path.join(
  __dirname,
  triggerType,
  'runner',
))
const runnerConstructor: IRunnerConstructor = runnerModule.default
const params = decodeOrThrow(
  Object.assign(
    {
      numberOfMessages: 30,
      faasParams: {},
    },
    argv,
  ),
  runnerModule.ParamsType,
)
const targets = decodeOrThrow(Object.assign({}, argv), runnerModule.TargetsType)

///////////////
// CLI Entry //
///////////////

const run = async () => {
  const runner = new runnerConstructor(
    {
      projectName: `trigger-${Date.now().toString(36)}`,
      triggerRunnerPublicIp: argv.triggerRunnerPublicIp,
      provider: {
        name: provider,
        params: {
          region: 'us-east-1',
        },
      },
    },
    params,
    targets,
  )
  await runner.setup()
  console.log(JSON.stringify(await runner.run(), null, 2))
  await runner.teardown()
}

if (require.main === module) {
  run().catch(e => {
    console.error(e)
    process.exit(1)
  })
}
