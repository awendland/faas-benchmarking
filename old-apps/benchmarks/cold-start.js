const path = require('path')

module.exports.Benchmark = class Benchmark {
  constructor({ provider, logger }) {
    this.provider = provider
    this.name = `cold-start`
    this.logger = logger
    this.teardowns = []
  }

  async setup(
    { numFunctions } = {
      numFunctions: process.env['NUM_FNS'] || 10,
    },
  ) {
    this.logger.info(`Function count: ${numFunctions}`)
    // TODO allow tuning the size of the source code payload
    const fnFactory = await FaasFactory.setup(this.provider, {
      name: 'cold-start',
      sourceDir: process.env['FN_SRC_DIR'] || path.join(__dirname, '../faas/'),
      handlerId: 'index.handler',
    })
    fns = Promise.all(
      _.range(0, numFunctions).map(async i => {
        fn = fnFactory.build({
          name: `cold-start-${i}`,
          runtime: 'Node8',
          size: 128,
          timeout: 300,
        })
        this.teardowns.push(await fn.deploy())
        this.logger.info(`.`, { end: '' })
      }),
    )
    this.logger.info(``)
    this.logger.info(`Preparing triggerer`)
    // await triggerer.prepare('cold-start', {
    //   functionUris: fns.map(f => f.url),
    //   rps: REQUESTS_PER_SECOND, // TODO this will likely need to be more complex
    // })
  }

  async run() {
    await triggerer.run({ logger: this.logger })
  }

  async teardown() {
    return await handleTeardowns(this.teardowns)
  }
}
