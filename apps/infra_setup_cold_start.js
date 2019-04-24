const path = require('path')
const _ = require('lodash')
const Promise = require('bluebird')
const winston = require('winston')
const { FaasFactory } = require('./lib/infra/components/Faas')
const { AwsProvider } = require('./lib/infra/providers/aws')

run().catch(e => console.error(e.stack))

async function run() {
  const numFns = parseInt(process.env['NUM_FNS']) || 10
  const logger = winston.createLogger({
    transports: [new winston.transports.Console({
      level: process.env['LOG_LEVEL'] || 'verbose',
      format: winston.format.simple(),
    })]
  })
  const projectName = process.env['TEST_NAME'] || `test-${Date.now().toString(36)}`
  const provider = await AwsProvider.create({
    projectName,
    logger: logger,
    region: 'us-east-1',
  })
  teardowns = []
  let lastTime = Date.now()

  await provider.faas.prepareHttpTrigger()
  logger.verbose(`Http Trigger prep took ${Date.now() - lastTime}ms`)

  lastTime = Date.now()
  const fnFactory = await FaasFactory.setup(provider, {
    name: 'standard',
    sourceDir: process.env['FN_SRC_DIR'] || path.join(__dirname, 'faas/'),
    handlerId: 'index.handler',
  })
  logger.verbose(`FaasFactory setup took ${Date.now() - lastTime}ms`)

  lastTime = Date.now()
  fns = await Promise.map(
    _.range(0, numFns),
    async (i) => {
      try {
        fn = fnFactory.build({
          name: `${projectName}-${i}`,
          runtime: 'Node8',
          size: 128,
          timeout: 300,
        })
        teardowns.push(await fn.deploy())
        return fn
      } catch (error) {
        logger.error({ message: `Failed to create FaaSInstance #${i}`, error })
        return null
      }
    },
    { concurrency: 4 }
  )
  await provider.faas.publishHttpFunctions()
  logger.verbose(`Deploying ${numFns} FaasInstances took ${Date.now() - lastTime}ms`)
  lastTime = Date.now()

  logger.info(fns.map(f => f.url).join('\n'))
}
