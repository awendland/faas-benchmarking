const path = require('path')
const _ = require('lodash')
const Promise = require('bluebird')
const winston = require('winston')
const { FaasFactory } = require('./lib/infra/components/Faas')
const { AwsProvider } = require('./lib/infra/providers/aws')
const { sleep } = require('./lib/utils')

const argv = require('minimist')(process.argv.slice(2))

const projectName =
  argv['project-name'] ||
  process.env['PROJ_NAME'] ||
  `test-${Date.now().toString(36)}`
const params = {
  numFns: parseInt(argv.numfns || process.env['NUM_FNS']) || 10,
  logLevel: argv.loglevel || process.env['LOG_LEVEL'] || 'verbose',
  projectName,
  existingFaasIam:
    argv['faas-iam'] || process.env['FAAS_IAM'] || `${projectName}-faas`,
  runtime: argv.runtime || process.env['RUNTIME'] || 'Node8',
  memSize: parseInt(argv.memsize || process.env['MEM_SIZE']) || 128,
  sourceDir:
    argv.source || process.env['FN_SRC_DIR'] || path.join(__dirname, '..', 'apps', 'faas/'),
  faasTimeout: parseInt(argv.timeout || process.env['FN_TIMEOUT']) || 300,
}

run().catch(e => {
  console.error(e.stack)
  process.exit(1)
})

async function run() {
  const logger = winston.createLogger({
    transports: [
      new winston.transports.Console({
        level: params.logLevel,
        format: winston.format.simple(),
      }),
    ],
  })
  const provider = await AwsProvider.create({
    projectName: params.projectName,
    logger: logger,
    region: 'us-east-1',
    existingFaasIam: params.existingFaasIam,
  })
  const teardowns = []
  let lastTime = Date.now()

  await provider.faas.prepareHttpTrigger()
  logger.verbose(`Http Trigger prep took ${Date.now() - lastTime}ms`)

  lastTime = Date.now()
  const fnFactory = await FaasFactory.setup(provider, {
    name: 'standard',
    sourceDir: params.sourceDir,
    handlerId: 'index.handler',
  })
  logger.verbose(`FaasFactory setup took ${Date.now() - lastTime}ms`)

  lastTime = Date.now()
  const fns = await Promise.map(
    _.range(0, params.numFns),
    async i => {
      try {
        const fn = fnFactory.build({
          name: `${params.projectName}-${i}`,
          runtime: params.runtime,
          size: params.memSize,
          timeout: params.faasTimeout,
        })
        teardowns.push(await fn.deploy())
        return fn
      } catch (error) {
        logger.error({ message: `Failed to create FaasInstance #${i}`, error })
        return null
      }
    },
    { concurrency: 4 },
  )
  await provider.faas.publishHttpFunctions()
  logger.verbose(
    `Deploying ${params.numFns} FaasInstances took ${Date.now() - lastTime}ms`,
  )
  lastTime = Date.now()

  logger.info(fns.map(f => f.url).join('\n'))
}
