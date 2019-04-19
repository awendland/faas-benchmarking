// Imports

run().catch(e => console.error(e.stack))

// Orchestrator
async function run() {
  const teardowns = []

  try {
    const requester = new RequesterInstance({
      size: "", // TODO probably based on # of RPS needed
    })
    teardowns.push(await requester.deploy())

    let benchmark
    try {
      benchmark = require(`./benchmarks/${BENCHMARK_MODE}`)({
        logger: logger,
      })
    } catch(e) {
      logger.error(`Unable to load ${BENCHMARK_MODE}`, e)
      return
    }

    await benchmark.setup()
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
