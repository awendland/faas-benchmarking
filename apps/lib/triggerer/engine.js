const _ = require('lodash')
const got = require('got')
const https = require('https')
const url = require('url')
const { sleep } = require('../utils')

module.exports.HttpEngine = class HttpEngine {
  /**
   * @param opts.windowSize - Number of milliseconds between batches of requests
   * @param opts.requestsPerWindow - How many requests to create during each batch. This can be
   *                                 a single value, or an array, which will be selected from
   *                                 in a round-robin style.
   * @param opts.requestUrls - Chosen in a round-robin fashion by each request in a batch
   * @param opts.requestPayloads - CURRENTLY UNUSED
   * @param opts.logger - Logger to use for reporting info (will default to noop)
   * @param opts.maxOpenRequests - If this cap would be exceeded with the new batch of requests,
   *                               then no requests will be scheduled that window. Defaults to 1024.
   */
  constructor(opts = {
    requestsGrowthRate: 0,
    logger: { error: () => undefined, info: () => undefined, debug: () => undefined },
    maxOpenRequests: 1024,
  }) {
    opts.requestsPerWindow = [].concat(opts.requestsPerWindow)
    Object.assign(this, opts)
    
    this.agent = new https.Agent({
      keepAlive: true,
      maxCachedSessions: this.maxOpenRequests,
      maxFreeSockets: this.maxOpenRequests,
      maxSockets: this.maxOpenRequests,
    })

    this._http = got.extend({
      agent: this.agent,
      retry: 0,
      followRedirect: false,
      responseType: 'text',
    })

    this._tick = 0
    this._shouldRun = false
    this._timeoutId = null

    this.pendingRequests = []
    this.responses = []
    this.errors = []
  }

  /**
   * Begin making requests
   */
  run() {
    this._shouldRun = true
    this._setupConnections().then(() => this._loop())
    return this
  }

  /**
   * Stop making requests, but allow all pending requests to complete (checking every
   * windowSize to see if they've concluded)
   */
  async drain() {
    this.logger.debug(`Draining all pending connections...`)
    this._shouldRun = false
    while (this.pendingRequests.length > 0) {
      this._printStatus()
      await sleep(500)
    }
    return this
  }

  /**
   * Stop making requests and abort any pending requests.
   */
  stop() {
    this._shouldRun = false
    this.pendingRequests.forEach(r => r.cancel())
    return this
  }
  
  async _setupConnections() {
    const connections = []
    for (let i = 0; i < this.maxOpenRequests; ++i) {
      const { host, port } = url.parse(this.requestUrls[i % this.requestUrls.length])
      connections.push(new Promise((res) => {
        this.agent.createConnection({ host, port }, res)
      }))
    }
    await connections
    this.logger.debug(`Prepared ${Object.keys(this.agent.freeSockets)} free sockets`)
  }
  
  _printStatus(windowStart=Date.now()) {
    this.logger.debug(`[${windowStart}]`
                    + `\tnew_req=${this._shouldRun ? `${this._numRequestsThisTick()}` : `draining`}`
                    + `\tnum_resp=${this.responses.length}`
                    + `\tnum_err=${this.errors.length}`
                    + `\tpending_req=${this.pendingRequests.length}`
                    + `\tlast_10: ${this.responses.slice(-10).map(r => (r && r.timings) ? r.timings.phases.total : 'TT').join(' ')}`)
  }

  async _loop() {
    let lastStart = Date.now()
    while (this._shouldRun) {
      const windowStart = Date.now()
      if (windowStart - lastStart > this.windowSize * 1.1)
        this.logger.warn(`CAN'T HIT LOAD TARGET! Took ${windowStart - lastStart}ms between ticks`)
      lastStart = windowStart
      this._printStatus(windowStart)

      await this._sendRequests()
      this._tick++

      const elapsed = Date.now() - windowStart
      const sleepMs = this.windowSize - elapsed
      if (sleepMs < 1)
        this.logger.warn(`CAN'T HIT LOAD TARGET! Ran ${-sleepMs}ms past request window`)
      else
        this.logger.debug(`Processed in ${elapsed}ms`)
      if (this._shouldRun) await sleep(sleepMs)
    }
  }

  _numRequestsThisTick() {
    return this.requestsPerWindow[this._tick % this.requestsPerWindow.length]
  }

  async _sendRequests() {
    if (this.pendingRequests.length > this.maxOpenRequests - this._numRequestsThisTick()) {
      this.logger.warn(`CAN'T HIT LOAD TARGET! Too many pending requests: ${this.pendingRequests.length}`)
    } else {
      const newRequests = _.range(0, this._numRequestsThisTick())
        .map((i) => {
          const url = this.requestUrls[i % this.requestUrls.length]
          const metadata = { url, tick: this._tick }
          const request = this._http.post(url)
          request
            .then(response => {
              this.pendingRequests.splice(this.pendingRequests.indexOf(request), 1)
              this.responses.push({
                ...metadata,
                window: this.windowSize,
                size: this._numRequestsThisTick(),
                timings: response.timings,
                body: response.body,
              })
            })
            .catch(e => {
              this.pendingRequests.splice(this.pendingRequests.indexOf(request), 1)
              if (request.isCanceled) {
                this.errors.push({ ...metadata, canceled: true })
              }
              else {
                this.errors.push({ ...metadata, error: e.toString() })
                this.logger.warn(`${e}`)
              }
            })
          return request
        })

      ;[].push.apply(this.pendingRequests, newRequests)
    }
  }

}
