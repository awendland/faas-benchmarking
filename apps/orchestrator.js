// Imports
const fs = require('fs')

run().catch(e => {
  console.error(e.stack)
  process.exit(1)
})

// Orchestrator
async function run() {
  const logger = console
  const teardowns = []

  try {
    const triggerer = new HttpTriggerer(provider, {
      size: '', // TODO probably based on # of RPS needed
      libVersion: '',
    })
    teardowns.push(await triggerer.deploy())
    // TODO check that Triggerer is reachable
    if (!(await triggerer.isReachable())) {
      logger.error(
        `Unable to connect to Requester at "${triggerer.vm.publicDNS}"`
      )
      return
    }

    this.logger.info(`Loading benchmark: ${BENCHMARK_MODE}`)
    let benchmark
    try {
      benchmark = require(`./benchmarks/${BENCHMARK_MODE}`)({
        logger: logger,
      })
    } catch (e) {
      logger.error(`Unable to load ${BENCHMARK_MODE}`, e)
      return
    }

    await benchmark.setup()
    logger.info(`Initialized benchmark: ${BENCHMARK_MODE}`)
    try {
      await benchmark.run()
    } finally {
      await benchmark.teardown()
    }
  } finally {
    // Cleanup infrastructure as best as possible
    return await this.handleTeardowns(teardowns)
  }
}
