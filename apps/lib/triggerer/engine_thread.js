const { workerData, parentPort } = require('worker_threads')
const { HttpEngine } = require('./engine')

console.log(`[worker${workerData.id}]`, workerData)

const engine = new HttpEngine({ ...workerData.engineArgs, logger: console })

parentPort.on('message', value => {
  console.log(`[worker${workerData.id}] ${value.cmd}`)
  ;({
    run: () => {
      engine.run().then(() => parentPort.postMessage({}))
    },
    drain: () => {
      engine.drain().then(() => parentPort.postMessage({}))
    },
    results: () => {
      engine.results().then(data => parentPort.postMessage(data))
    },
    stop: () => {
      engine.stop().then(() => parentPort.postMessage({}))
    },
  }[value.cmd]())
})
