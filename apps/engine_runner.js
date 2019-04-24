const { HttpEngine } = require('./lib/triggerer/engine')
const fs = require('fs') 

const warm_start_engine = new HttpEngine({
  windowSize: 250,
  requestsPerWindow: 1,
  requestPayloads: null,
  requestUrls: ['https://dcd6lfz4a9.execute-api.us-east-1.amazonaws.com/test/test-0'],
  logger: console,
})

warm_start_engine.run()

setTimeout(() => {
  warm_start_engine.stop()
  console.dir(warm_start_engine.responses)
  fs.writeFile("warm_start_engine_"+Date.now(), warm_start_engine.responses)
}, 1000)

//.map(r => r.timings.phases)