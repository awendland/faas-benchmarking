const { HttpEngine } = require('./lib/engine')

const engine = new HttpEngine({
  windowSize: 100,
  requestsPerWindow: 200,
  requestPayloads: null,
  requestUrls: ['http://alexwendland.com'],
  logger: console,
})

engine.run()

setTimeout(() => {
  engine.stop()
}, 10000)
