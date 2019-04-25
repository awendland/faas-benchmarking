const { HttpEngine } = require('./lib/triggerer/engine')
const fs = require('fs')

const windowSize = parseInt(process.env['WINDOW']) || 500
const requestsPerWindow = parseInt(process.env['RPW']) || 20
const requestUrls = process.env['URLS'] ? process.env['URLS'].split(',') : ['http://alexwendland.com']

const warm_start_engine = new HttpEngine({
  windowSize,
  requestsPerWindow,
  requestPayloads: null,
  requestUrls,
  logger: console,
})

warm_start_engine.run()

setTimeout(() => {
  warm_start_engine.drain()
  const output = JSON.stringify({
    responses: warm_start_engine.responses,
    errors: warm_start_engine.errors,
  }, null, 2)
  fs.writeFileSync(`results-${Date.now()}-w${windowSize}r${requestsPerWindow}.json`, output)
}, 10000)

//.map(r => r.timings.phases)
