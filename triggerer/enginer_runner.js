const HttpEngine = require('./lib/engine')

const engine = new HttpEngine({
  windowSize: 1000,
  requestsPerWindow: 1,
  requestPayload: null,
  requestUrls: ['http://google.com'],
  logger: console
})

engine.run()

setTimeout(() => {
  engine.stop()
}, 10000)
