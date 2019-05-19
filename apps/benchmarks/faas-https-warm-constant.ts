import { createHttpsBenchmark } from './lib/faas-https-shared'

///////////////////
// Warm Constant //
///////////////////

createHttpsBenchmark({
  benchmarkName: 'warm-constant',
  numberOfFunctions: 1,
  initialMsgPerSec: 50,
  incrementMsgPerSec: 0,
  incrementPeriod: 10 * 1e3,
  numberOfPeriods: 20,
  functionSleep: undefined,
}).catch(e => {
  console.error(e)
  process.exit(1)
})
