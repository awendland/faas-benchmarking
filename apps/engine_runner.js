const fs = require('fs')
const { URL } = require('url')
const { sleep } = require('./lib/utils')
const { toMsTimings } = require('./lib/triggerer/http-hrtimer')

const argv = require('minimist')(process.argv.slice(2))

const windowSize = parseInt(argv['window-size'] || process.env['WINDOW']) || 500
const requestsPerWindow = String(argv.rpw || process.env['RPW'] || '20')
  .split(',')
  .map(s => parseInt(s))
const url = new URL(argv.url || process.env['URL'] || 'http://alexwendland.com')
const testDuration = parseInt(argv.duration || process.env['TEST_DUR']) || 10000
const filename =
  argv.out ||
  process.env['FILE_NAME'] ||
  `${new Date().toISOString()}-w${windowSize}r${requestsPerWindow}.results`
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
    url,
    logger: console,
  }
  let httpEngine
  if (parallelize === 1) {
    const { HttpEngine } = require('./lib/triggerer/engine')
    httpEngine = new HttpEngine(opts)
  } else {
    // Since ParallelizedHttpEngine depends on worker_threads, which aren't
    // available w/o a special flag, only import it if need be
    const {
      ParallelizedHttpEngine,
    } = require('./lib/triggerer/parallelized_engine')
    httpEngine = new ParallelizedHttpEngine(opts, parallelize)
  }

  const startTime = process.hrtime()
  await httpEngine.run()
  await sleep(testDuration)
  await httpEngine.drain()
  const results = await httpEngine.results()
  await httpEngine.stop()

  const output = JSON.stringify(
    {
      responses: results.responses.map(r => ({
        ...r,
        timings: toMsTimings(r.timings, startTime),
        body: typeof r.body === 'string' ? r.body : r.body.toString('utf8'),
      })),
      errors: results.errors,
    },
    null,
    2,
  )
  fs.writeFileSync(`${filename}`, output)
}
