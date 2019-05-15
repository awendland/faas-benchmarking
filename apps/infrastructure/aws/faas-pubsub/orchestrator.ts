import * as fs from 'fs'
import { promisify } from 'util'
import * as cp from 'child_process'
import * as Path from 'path'
import * as _ from 'lodash'
import { translateToAws } from '../faas'
import {
  HttpsFaasOrchestrator,
  HttpsFaasOrchestratorConfig,
} from '../../shared'

const writeFile = promisify(fs.writeFile)
const deleteFile = promisify(fs.unlink)
const execFile = promisify(cp.execFile)

export default class AwsHttpsFaasOrchestrator implements HttpsFaasOrchestrator {
  constructor(public config: HttpsFaasOrchestratorConfig) {}

  async setup() {
    const cwd = __dirname
    const queueName = `${this.config.projectName}Queue`
    const serverlessYaml = `
service: ${this.config.projectName}
provider:
  name: aws
  runtime: ${translateToAws.runtime(this.config.runtime)}
  stackName: ${this.config.projectName}
  apiName: ${this.config.projectName}
functions:
${_.range(this.config.numberOfFunctions)
  .map(
    i => `
  fn${i}:
    handler: ${this.config.sourceDir}.handler
    memorySize: ${this.config.memorySize}
    timeout: ${this.config.timeout}
    events:
      - sqs:
          batchSize: 1
          arn:
            Fn::GetAtt:
              - ${queueName}
              - Arn`,
  )
  .join('\n')}
resources:
  Resources:
    ${queueName}:
      Type: "AWS::SQS::Queue"
      Properties:
        QueueName: "${queueName}"
`
    await writeFile(Path.join(cwd, 'serverless.yml'), serverlessYaml)
    await execFile('serverless', [], { cwd })
  }

  async teardown() {
    deleteFile('serverless.yml')
  }
}
