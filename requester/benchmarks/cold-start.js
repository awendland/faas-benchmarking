
module.export.Benchmark = class Benchmark {
  constructor({logger}) {
    this.logger = logger
    this.teardowns = []
  }

  async setup() {
    this.logger.info("Benchmark: cold-start")
    this.logger.info(`Function count: ${NUM_FUNCTIONS}`)
    fns = Promise.all(
      range(0, NUM_FUNCTIONS)
      .map(async (i) => {
        const nonce = `${i}-${Date.now}`
        await fs.writeFile(path.join(FUNCTION_SRC_FOLDER, 'nonce'), nonce)
        fn = new FaaSInstance({
          provider: aws,
          name: `cold-start-${i}`,
          sourceFolder: FUNCTION_SRC_FOLDER,
          trigger: "http",
        })
        this.teardowns.push(await fn.deploy())
        this.logger.info(`.`, {end: ''})
      }))
    this.logger.info(``)
    this.logger.info(`Preparing requester`)
    await requester.prepare("cold-start", {
      functionUris: fns.map(f => f.name),
      rps: REQUESTS_PER_SECOND, // TODO this will likely need to be more complex
    })
  }

  async run() {
    await requester.run({logger: logger})
  }

  async teardown() {
    return await handleTeardowns(this.teardowns)
  }
}
