import { createHttpsBenchmark } from './lib/faas-https-shared'

///////////////////
// Warm Constant //
///////////////////

createHttpsBenchmark({
  benchmarkName: 'warm-constant',
  // Cloudformation max is 200 resources which is ~10 https fns
  numberOfFunctions: 1,
  initialMsgPerSec: 50,
  incrementMsgPerSec: 0,
  incrementPeriod: 10 * 1e3,
  numberOfPeriods: 20,
  functionSleep: 5000,
}).catch(e => {
  console.error(e)
  process.exit(1)
})
