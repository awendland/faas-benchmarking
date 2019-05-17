import * as fs from 'fs-extra'
import { promisify } from 'util'
import * as cp from 'child_process'
import * as Path from 'path'
import * as t from 'io-ts'
import * as _ from 'lodash'
import { dir as createtmpdir, DirectoryResult } from 'tmp-promise'
import { IContext } from '../../../shared/types'
import { decodeOrThrow } from '../../../shared/utils'
import { serverlessBin } from '../shared'
import { translateToAws, prepareHandlerCodeZip } from '../faas'
import {
  IHttpsFaasOrchestrator,
  HttpsFaasOrchestratorParams,
  IHttpsFaasOrchestratorParams,
} from '../../shared'

const execFile = promisify(cp.execFile)

/**
 * So that this module conforms to:
 * {
 *  default: IOrchestratorConstructor,
 *  ParamsType: typeof default.params,
 * }
 */
export const ParamsType = HttpsFaasOrchestratorParams

/**
 *
 */
export default class AwsHttpsFaasOrchestrator
  implements IHttpsFaasOrchestrator {
  private tmpdir: DirectoryResult | null = null

  /**
   * NOTE: Due to CloudFormation's resource limit of 200, there is a cap of
   * ~30 functions that can be created at once
   */
  constructor(
    public context: IContext,
    public params: IHttpsFaasOrchestratorParams,
  ) {
    if (this.context.provider.name !== 'aws') {
      throw new Error(
        `${this.constructor.name} was provided a context for ${
          this.context.provider.name
        }`,
      )
    }
    decodeOrThrow(this.params, HttpsFaasOrchestratorParams)
  }

  /**
   * NOTE: creating 30 functions takes ~100 seconds.
   */
  async setup() {
    const startTime = Date.now()
    const queueName = `${this.context.projectName}Queue`
    this.tmpdir = await createtmpdir({
      prefix: 'faas-https-aws-',
      unsafeCleanup: true,
    })
    console.info(`Working in ${this.tmpdir.path}`)

    const packageZip = Path.join(this.tmpdir.path, 'faas.zip')
    await prepareHandlerCodeZip(Path.resolve(this.params.sourceDir), packageZip)

    // TODO use specified AWS region
    const serverlessYaml = `
service: ${this.context.projectName}
provider:
  name: aws
  runtime: ${translateToAws.runtime(this.params.runtime)}
  stackName: ${this.context.projectName}
  apiName: ${this.context.projectName}
package:
  artifact: ${packageZip}
functions:
${_.range(this.params.numberOfFunctions)
  .map(
    i => `
  fn${i}:
    handler: index.${this.context.provider.name}_https
    memorySize: ${this.params.memorySize}
    timeout: ${this.params.timeout}
    events:
      - http: post fn${i}`,
  )
  .join('\n')}
`
    await fs.writeFile(
      Path.join(this.tmpdir.path, 'serverless.yml'),
      serverlessYaml,
    )

    console.debug(`Running ${serverlessBin} deploy`)
    const { stdout } = await execFile(
      serverlessBin,
      [`--region=${this.context.provider.params.region}`, `deploy`],
      {
        cwd: this.tmpdir.path,
        maxBuffer: 50 * 1024 * 1024, // Max amount of bytes allowed on stdout and stderr
      },
    )
    console.debug(stdout)
    console.debug(`Setup in ${(Date.now() - startTime) / 1000} sec`)

    return {
      urls: (() => {
        const endpointsRaw = stdout.match(
          /endpoints:\s([\s\S]+)\sfunctions:/m,
        )![1]
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
      const startTime = Date.now()
      console.debug(`Running ${serverlessBin} remove`)
      const { stdout } = await execFile(serverlessBin, [`remove`], {
        cwd: this.tmpdir.path,
      })
      console.debug(stdout)
      await this.tmpdir.cleanup()
      console.debug(`Teardown in ${(Date.now() - startTime) / 1000} sec`)
    }
  }
}
