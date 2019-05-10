const log = console.log
console.log = () => {}
const faasSrc = require('../../apps/faas/index')

const numRuns = 1e6
const startTime = Date.now()
for (let i = 0; i < numRuns; ++i) {
  faasSrc.handler({}, {functionName: '', functionVersion: '', invokedFunctionArn: '', awsRequestId: ''})
}
const elapsedTime = Date.now() - startTime
log(`Took ${elapsedTime}ms for ${numRuns} runs = ${elapsedTime / numRuns}ms/run`)