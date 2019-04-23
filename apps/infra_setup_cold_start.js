const path = require('path')
const _ = require('lodash')
const { FaasFactory } = require('./lib/infra/components/Faas')
const { AwsProvider } = require('./lib/infra/providers/aws')

run().catch(e => console.error(e.stack))

async function run() {
  const numFns = 1
  const provider = await AwsProvider.create({
    projectName: 'test',
    logger: console,
    region: 'us-east-1',
  })
  teardowns = []

  let lastTime = Date.now()
  const fnFactory = await FaasFactory.setup(provider, {
    name: 'test',
    sourceDir: process.env['FN_SRC_DIR'] || path.join(__dirname, 'faas/'),
    handlerId: 'index.handler',
  })
  console.log(`FaasFactory setup took ${Date.now() - lastTime}ms`); lastTime = Date.now()
  fns = await Promise.all(_.range(0, numFns)
    .map(async (i) => {
      fn = fnFactory.build({
        name: `test-${i}`,
        runtime: 'Node8',
        size: 128,
        timeout: 300,
      })
      teardowns.push(await fn.deploy())
      return fn
    }))
  console.log(`Deploying ${numFns} FaasInstances took ${Date.now() - lastTime}ms`); lastTime = Date.now()
  await provider.faas.publishHttpFunctions()
  console.info(fns.map(f => f.url).join('\n'))
}
