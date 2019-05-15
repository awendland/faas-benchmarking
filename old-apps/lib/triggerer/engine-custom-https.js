const _ = require('lodash')
// process.binding('http_parser').HTTPParser = require('http-parser-js').HTTPParser
const https = require('https')
const { URL } = require('url')
const AgentKeepAlive = require('agentkeepalive').HttpsAgent
const { HttpConnection } = require('./http-connection')
const { default: hrtimer, toMsTimings } = require('./http-hrtimer')
const { sleep } = require('../utils')

module.exports.HttpEngine = class HttpEngine {
  /**
   * @param opts.windowSize - Number of milliseconds between batches of requests
   * @param opts.requestsPerWindow - How many requests to create during each batch. This can be
   *                                 a single value, or an array, which will be selected from
   *                                 in a round-robin style.
   * @param opts.url - URL to send requests to (should be a URL object)
   * @param opts.requestPayloads - CURRENTLY UNUSED
   * @param opts.logger - Logger to use for reporting info (will default to noop)
   * @param opts.maxOpenRequests - If this cap would be exceeded with the new batch of requests,
   *                               then no requests will be scheduled that window. Defaults to 1024.
   */
  constructor(opts) {
    opts = Object.assign(
      {
        // Set defaults
        logger: {
          error: () => undefined,
          info: () => undefined,
          debug: () => undefined,
        },
        maxOpenRequests: 1500,
      },
      opts,
    )
    opts.requestsPerWindow = [].concat(opts.requestsPerWindow) // Ensure it's an array
    Object.assign(this, opts)

    if (!this.url.port || String(this.url.port) === '80') {
      this.url.port = this.url.protocol === 'https:' ? '443' : '80'
    }

    this._conns = { free: [], active: [] }
    this._tick = 0
    this._shouldRun = false
    this._timeoutId = null

    this.pendingRequests = []
    this.responses = []
    this.errors = []
  }

  /**
   * Begin making requests
   *
   * Will resolve once initial TCP connections have been warmed up, but before
   * actual requests are run.
   */
  async run() {
    this._shouldRun = true
    await this._setupConnections()
    this._startTime = process.hrtime()
    this._loop()
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
    this.logger.debug(`All pending connections drained...`)
    return this
  }

  /**
   * Stop making requests and abort any pending requests.
   */
  async stop() {
    this._shouldRun = false
    this.pendingRequests.forEach(r => r.cancel())
    return this
  }

  /**
   * Retrieve the results from all the requests (results + errors)
   */
  async results() {
    return {
      responses: this.responses,
      errors: this.errors,
    }
  }

  _printStatus(windowStart = Date.now()) {
    this.logger.debug(
      `[${windowStart}]` +
        `\tnew_req=${
          this._shouldRun ? `${this._numRequestsThisTick()}` : `draining`
        }` +
        `\tnum_resp=${this.responses.length}` +
        `\tnum_err=${this.errors.length}` +
        `\tpending_req=${this.pendingRequests.length}` +
        `\tlast_10: ${this.responses
          .slice(-10)
          .map(r =>
            r && r.timings && r.timings.phases ? r.timings.phases.total : 'TT',
          )
          .join(' ')}`,
    )
  }

  async _loop() {
    let lastStart = Date.now()
    while (this._shouldRun) {
      const windowStart = Date.now()
      if (windowStart - lastStart > this.windowSize * 1.1)
        this.logger.warn(
          `CAN'T HIT LOAD TARGET! Took ${windowStart -
            lastStart}ms between ticks`,
        )
      lastStart = windowStart
      this._printStatus(windowStart)

      await this._sendRequests()
      this._tick++

      const elapsed = Date.now() - windowStart
      const sleepMs = this.windowSize - elapsed
      if (sleepMs < 1)
        this.logger.warn(
          `CAN'T HIT LOAD TARGET! Ran ${-sleepMs}ms past request window`,
        )
      else this.logger.debug(`Processed in ${elapsed}ms`)
      if (this._shouldRun) await sleep(sleepMs)
    }
  }

  _numRequestsThisTick() {
    return this.requestsPerWindow[this._tick % this.requestsPerWindow.length]
  }

  _maxRequests() {
    return Math.max(...this.requestsPerWindow)
  }

  async _setupConnections() {
    const connectPromises = _.range(this._maxRequests()).map(() =>
      new HttpConnection({
        hostname: this.url.hostname,
        port: this.url.port,
        protocol: this.url.protocol,
      }).connect(),
    )
    this._conns.free = await Promise.all(connectPromises)
    this.logger.debug(`Prepared ${this._conns.free.length} sockets`)
  }

  async _sendRequests() {
    if (this._conns.free.length < this._numRequestsThisTick()) {
      this.logger.warn(
        `CAN'T HIT LOAD TARGET! Too many pending requests: ${
          this.pendingRequests.length
        }`,
      )
    } else {
      for (let i = 0; i < this._numRequestsThisTick(); ++i) {
        const metadata = {
          url: this.url.toString(),
          tick: this._tick,
          window: this.windowSize,
          size: this._numRequestsThisTick(),
        }
        const httpconn = this._conns.free.pop()
        const request = httpconn.request({
          method: 'POST',
          path: this.url.path,
        })
        this.pendingRequests.push(request)
        this._conns.active.push(httpconn)
        const requestFinished = () => {
          this.pendingRequests.splice(this.pendingRequests.indexOf(request), 1)
          this._conns.active.splice(this._conns.active.indexOf(httpconn), 1)
          this._conns.free.push(httpconn)
        }
        request.then(resp => {
          requestFinished()
          this.responses.push({
            ...metadata,
            timings: {
              start: resp.timings.connect,
              lookup: resp.timings.connect,
              connect: resp.timings.connect,
              upload: resp.timings.connect,
              response: resp.timings.response,
              end: resp.timings.end,
            },
            body: resp.body,
          })
        })
        request.catch(e => {
          requestFinished()
          if (request.isCanceled) {
            this.errors.push({ ...metadata, canceled: true })
          } else {
            this.errors.push({ ...metadata, error: e.toString() })
            this.logger.warn(`${e}`)
          }
        })
      }
    }
  }
}
