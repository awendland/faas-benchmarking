import { createHttpsBenchmark } from './lib/faas-https-shared'

///////////////////
// Warm Constant //
///////////////////

createHttpsBenchmark({
  benchmarkName: 'cold-start',
  // Cloudformation max is 200 resources which is ~10 https fns
  numberOfFunctions: 58,
  initialMsgPerSec: 1,
  incrementMsgPerSec: 0,
  incrementPeriod: 2 * 1e3,
  numberOfPeriods: 1,
  functionSleep: 0,
}).catch(e => {
  console.error(e)
  process.exit(1)
})
