const { Worker } = require('worker_threads')
const os = require('os')
const _ = require('lodash')

module.exports.ParallelizedHttpEngine = class ParallelizedHttpEngine {
  /**
   * @param opts - See HttpEngine
   * @param threadCount - Number of HttpEngine instances to parallelize. Defaults to # of CPU cores.
   */
  constructor(opts, threadCount = os.cpus().length) {
    console.log(threadCount)
    let chunkedUrls
    if (opts.requestUrls.length % threadCount === 0) {
      chunkedUrls = _.chunk(opts.requestUrls, threadCount)
    }
    this.workers = _.range(threadCount).map(i => {
      // TODO use a better equal distribution algorithm here (too tired rn)
      // This currently breaks URL hit assumptions if the # urls != {1,RPW}
      let requestsPerWindow
      if (i === 0) {
        requestsPerWindow = opts.requestsPerWindow.map(
          v => v - Math.floor(v / threadCount) * (threadCount - 1),
        )
      } else {
        requestsPerWindow = opts.requestsPerWindow.map(v =>
          Math.floor(v / threadCount),
        )
      }
      const worker = new Worker(__dirname + '/engine_thread.js', {
        workerData: {
          id: i,
          engineArgs: {
            ..._.omit(opts, ['logger']),
            requestsPerWindow,
            requestUrls: chunkedUrls ? chunkedUrls[i] : opts.requestUrls,
            maxOpenRequests:
              Math.round(opts.maxOpenRequests / threadCount) || undefined, // Eh, just get close enough for now
          },
        },
      })
      return worker
    })
  }

  _runAsyncMethod(methodName, args = {}) {
    return new Promise(async (resolve, reject) => {
      this.workers.forEach(w => w.on('error', reject))
      const jobs = Promise.all(
        this.workers.map(
          w => new Promise(respond => w.once('message', respond)),
        ),
      )
      this.workers.forEach(w => w.postMessage({ cmd: methodName, args }))
      const responses = await jobs
      this.workers.forEach(w => {
        w.off('message', resolve)
        w.off('error', reject)
      })
      resolve(responses)
    })
  }

  run() {
    return this._runAsyncMethod('run')
  }

  drain() {
    return this._runAsyncMethod('drain')
  }

  async results() {
    const returns = await this._runAsyncMethod('results')
    return {
      responses: [].concat(...returns.map(r => r.responses)),
      errors: [].concat(...returns.map(r => r.errors)),
    }
  }

  async stop() {
    const resp = await this._runAsyncMethod('stop')
    this.workers.forEach(w => w.unref())
    return resp
  }
}
