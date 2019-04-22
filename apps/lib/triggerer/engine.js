const _ = require('lodash')
const got = require('got')

module.exports.HttpEngine = class HttpEngine {
  /**
   * @param opts.windowSize - Number of milliseconds between batches of requests
   * @param opts.requestsPerWindow - How many requests to create during each batch
   * @param opts.requestUrls - Chosen in a round-robin fashion by each request in a batch
   * @param opts.requestPayloads - CURRENTLY UNUSED
   * @param opts.logger - Logger to use for reporting info (will default to noop)
   * @param opts.maxOpenRequests - If this cap would be exceeded with the new batch of requests,
   *                               then no requests will be scheduled that window. Defaults to 1024.
   */
  constructor(opts = {
    logger: { error: () => undefined, info: () => undefined, debug: () => undefined },
    maxOpenRequests: 1024,
  }) {
    Object.assign(this, opts)

    this._http = got.extend({
      retry: 0,
      followRedirect: false,
      responseType: 'buffer',
    })

    this._tick = 0
    this._shouldRun = false
    this._timeoutId = null

    this.pendingRequests = []
    this.responses = []
    this.errors = []
  }

  run() {
    this._shouldRun = true
    this._runWindow()
  }

  stop() {
    this._shouldRun = false
    this._cancelWindow()
    this.pendingRequests.forEach(r => r.cancel())
  }

  _cancelWindow() {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId)
      return true
    }
    return false
  }

  _scheduleWindow(sleep = 0) {
    if (!this._timeoutId && this._shouldRun) {
      this._timeoutId = setTimeout(() => {
        this._timeoutId = null
        this._runWindow()
      }, sleep)
      return true
    }
    return false
  }

  async _runWindow() {
    const windowStart = Date.now()
    this._tick++

    this.logger.debug(`${windowStart} num_resp=${this.responses.length}\tnum_err=${this.errors.length}\tpending_req=${this.pendingRequests.length}\tlast_10: ${this.responses.slice(-10).map(r => r.totalRTT || 'TT').join(" ")}`)

    if (this.pendingRequests.length > this.maxOpenRequests - this.requestsPerWindow) {
      this.logger.warn(`CAN'T HIT LOAD TARGET! Too many pending requests: ${this.pendingRequests.length}`)
    } else {
      const newRequests = _.range(0, this.requestsPerWindow)
        .map((i) => {
          const url = this.requestUrls[i % this.requestUrls.length]
          const metadata = { url, _tick: this._tick }
          const request = this._http.get(url)
          request
            .then(response => {
              this.pendingRequests.splice(this.pendingRequests.indexOf(request), 1)
              this.responses.push({
                ...metadata,
                uploadTime: response.timings.upload,
                responseTime: response.timings.response,
                tcpRTT: response.timings.phases.tcp,
                totalRTT: response.timings.phases.total,
              })
            })
            .catch(e => {
              this.pendingRequests.splice(this.pendingRequests.indexOf(request), 1)
              if (request.isCanceled) {
                this.errors.push({ ...metadata, canceled: true })
              }
              else {
                this.errors.push({ ...metadata, error: e.toString() })
                this.logger.error(`${e}`)
              }
            })
          return request
        })

      ;[].push.apply(this.pendingRequests, newRequests)
    }

    // TODO handle if it can't send enough requests per window
    const elapsed = Date.now() - windowStart
    const sleep = this.windowSize - elapsed
    if (sleep < 1)
      this.logger.warn(`CAN'T HIT LOAD TARGET! Ran ${-sleep}ms past request window`)
    else
      this.logger.debug(`Processed in ${elapsed}ms`)
    this._scheduleWindow(sleep)
  }

}
