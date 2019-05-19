import { createHttpsBenchmark } from './lib/faas-https-shared'

///////////////////
// Warm Constant //
///////////////////

createHttpsBenchmark({
  benchmarkName: 'warm-scaling',
  numberOfFunctions: 1,
  initialMsgPerSec: 5,
  incrementMsgPerSec: 5,
  incrementPeriod: 10 * 1e3,
  numberOfPeriods: 20,
  functionSleep: undefined,
}).catch(e => {
  console.error(e)
  process.exit(1)
})
