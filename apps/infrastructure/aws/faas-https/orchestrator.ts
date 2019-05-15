import * as fs from 'fs'
import { promisify } from 'util'
import * as cp from 'child_process'
import * as Path from 'path'
import * as _ from 'lodash'
import { dir as createtmpdir, DirectoryResult } from 'tmp-promise'
import { AwsProvider } from '../shared'
import { translateToAws, prepareHandlerCodeZip } from '../faas'
import {
  HttpsFaasOrchestrator,
  HttpsFaasOrchestratorConfig,
} from '../../shared'

/*
 * Path to the `serverless` command that is locally installed with this project,
 * (as opposed to the global one which might be the wrong version)
 */
const serverlessBin = (() => {
  const serverlessFile = require.resolve('serverless')
  const prefix = serverlessFile.split('node_modules')[0]
  return Path.join(prefix, 'node_modules', '.bin', 'serverless')
})()

const writeFile = promisify(fs.writeFile)
const execFile = promisify(cp.execFile)

export default class AwsHttpsFaasOrchestrator
  implements HttpsFaasOrchestrator<AwsProvider> {
  private tmpdir: DirectoryResult | null = null

  constructor(
    public provider: AwsProvider,
    public config: HttpsFaasOrchestratorConfig,
  ) {}

  async setup() {
    const startTime = Date.now()
    const queueName = `${this.config.projectName}Queue`
    this.tmpdir = await createtmpdir({ unsafeCleanup: true })
    console.info(`Working in ${this.tmpdir.path}`)
    const packageZip = Path.join(this.tmpdir.path, 'faas.zip')
    try {
      await prepareHandlerCodeZip(
        Path.resolve(this.config.sourceDir),
        packageZip,
      )
    } catch (e) {
      console.error(e)
    }
    const serverlessYaml = `
service: ${this.config.projectName}
provider:
  name: aws
  runtime: ${translateToAws.runtime(this.config.runtime)}
  stackName: ${this.config.projectName}
  apiName: ${this.config.projectName}
package:
  artifact: ${packageZip}
functions:
${_.range(this.config.numberOfFunctions).map(
  i => `
  fn${i}:
    handler: index.handler
    memorySize: ${this.config.memorySize}
    timeout: ${this.config.timeout}
    events:
      - http: post fn${i}`,
)}
`
    await writeFile(
      Path.join(this.tmpdir.path, 'serverless.yml'),
      serverlessYaml,
    )
    console.debug(`Running ${serverlessBin} deploy`)
    const { stdout } = await execFile(
      serverlessBin,
      [`--region=${this.provider.region}`, `deploy`],
      {
        cwd: this.tmpdir.path,
        maxBuffer: 50 * 1024 * 1024, // Max amount of bytes allowed on stdout and stderr
      },
    )
    console.debug(stdout)
    console.debug(`Setup in ${(Date.now() - startTime) / 1000} sec`)
    return {
      urls: (() => {
        const endpointsRaw = stdout.match(/endpoints:\s([\s\S]+)\sfunctions:/m)![1]
        return endpointsRaw.split('\n').map(
          l =>
            l
              .trim()
              .replace(/,$/, '')
              .match(/\w{3,6} - (.+)$/)![1],
        )
      })(),
    }
  }

  async teardown() {
    if (this.tmpdir) {
      try {
        const {stdout} = await execFile(serverlessBin, [`remove`], {
          cwd: this.tmpdir.path,
        })
        console.debug(stdout)
        await this.tmpdir.cleanup()
      } catch (e) {
        console.error(e)
      }
    }
  }
}
