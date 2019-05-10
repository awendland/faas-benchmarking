const fs = require('fs')
const { sleep } = require('./lib/utils')

const argv = require('minimist')(process.argv.slice(2))

const windowSize = parseInt(argv['window-size'] || process.env['WINDOW']) || 500
const requestsPerWindow = String(argv.rpw || process.env['RPW'] || '20')
  .split(',')
  .map(s => parseInt(s))
const requestUrls = (
  argv.urls ||
  process.env['URLS'] ||
  'http://alexwendland.com'
).split(',')
const testDuration = parseInt(argv.duration || process.env['TEST_DUR']) || 10000
const filename =
  argv.out ||
  process.env['FILE_NAME'] ||
  `results-${Date.now()}-w${windowSize}r${requestsPerWindow}`
const parallelize = parseInt(argv.threads || process.env['THREADS']) || 1

run().catch(e => {
  console.error(e.stack)
  process.exit(1)
})

async function run() {
  const opts = {
    windowSize,
    requestsPerWindow,
    requestPayloads: null,
    requestUrls,
    logger: console,
  }
  let httpEngine
  if (parallelize === 1) {
    const { HttpEngine } = require('./lib/triggerer/engine')
    httpEngine = new (HttpEngine)(opts)
  } else {
    // Since ParallelizedHttpEngine depends on worker_threads, which aren't
    // available w/o a special flag, only import it if need be
    const { ParallelizedHttpEngine } = require('./lib/triggerer/parallelized_engine')
    httpEngine = new ParallelizedHttpEngine(opts, parallelize)
  }

  await httpEngine.run()
  await sleep(testDuration)
  await httpEngine.drain()
  const results = await httpEngine.results()
  await httpEngine.stop()

  const output = JSON.stringify(
    {
      responses: results.responses,
      errors: results.errors,
    },
    null,
    2,
  )
  fs.writeFileSync(`${filename}`, output)
}
