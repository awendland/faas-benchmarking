const log = console.log
console.log = () => {}
const faasSrc = require('../../apps/faas/index')

const run = async () => {
  const numRuns = 1e6
  const startTime = Date.now()
  for (let i = 0; i < numRuns; ++i) {
    await faasSrc.handler(
      {},
      {
        functionName: '',
        functionVersion: '',
        invokedFunctionArn: '',
        awsRequestId: '',
      },
    )
  }
  const elapsedTime = Date.now() - startTime
  log(
    `Took ${elapsedTime}ms for ${numRuns} runs = ${elapsedTime /
      numRuns}ms/run`,
  )
}

run().catch(e => {
  console.error(e)
  process.exit(1)
})
