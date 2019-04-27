const { HttpEngine } = require('./lib/triggerer/engine')
const fs = require('fs')
const { sleep } = require('./lib/utils')

const argv = require('minimist')(process.argv.slice(2))

const windowSize = parseInt(argv['window-size'] || process.env['WINDOW']) || 500
const requestsPerWindow = parseInt(argv.rpw || process.env['RPW']) || 20
const requestsGrowthRate = parseInt(argv['req-growth'] || process.env['REQ_GROWTH']) || 0
const requestUrls = (argv.urls || process.env['URLS'] || 'http://alexwendland.com').split(',')
const testDuration = parseInt(argv.duration || process.env['TEST_DUR']) || 10000
const filename = argv.out || process.env['FILE_NAME'] || `results-${Date.now()}-w${windowSize}r${requestsPerWindow}`

run().catch(e => { console.error(e.stack); process.exit(1) })

async function run() {

  const warm_start_engine = new HttpEngine({
    windowSize,
    requestsPerWindow,
    requestsGrowthRate,
    requestPayloads: null,
    requestUrls,
    logger: console,
  })

  warm_start_engine.run() // Intentionally do not `await` this
  await sleep(testDuration)
  await warm_start_engine.drain()
  
  const output = JSON.stringify({
    responses: warm_start_engine.responses,
    errors: warm_start_engine.errors,
  }, null, 2)
  fs.writeFileSync(`${filename}`, output)

}