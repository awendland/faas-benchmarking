const _ = require('lodash')
const https = require('https')
const { URL } = require('url')
const AgentKeepAlive = require('agentkeepalive').HttpsAgent
const url = require('url')
const { default: hrtimer, toMsTimings } = require('./http-hrtimer')
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
    
    this._urls = this.requestUrls.map(s => new URL(s)).map(u => {
      if (!u.port || String(url.port) === '80') {
        u.port = u.protocol === 'https:' ? '443' : '80'
      }
      return u
    })

    this._agent = new AgentKeepAlive({
      freeSocketTimeout: this.windowSize * 3,
      maxCachedSessions: this.maxOpenRequests,
      maxFreeSockets: this.maxOpenRequests,
      maxSockets: this.maxOpenRequests,
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

  async _setupConnections() {
    const statusId = setInterval(() => {
      this.logger.debug(this._agent.getCurrentStatus())
    }, 5000)
    const nullsOrErrors = await Promise.all(
      _.range(this._maxRequestsPerWindow()).map(
        i =>
          new Promise((resolve, reject) => {
            const { hostname, port } = this._urls[i % this._urls.length]
            const reqOptions = {
              hostname,
              port,
              agent: this._agent,
              method: 'HEAD',
            }
            // TODO pre-warm TCP connection only, don't make full HTTP request
            const req = https.request(reqOptions, res => {
              res.resume()
              res.on('end', () => resolve())
            })
            req.on('error', err => resolve(err))
            req.end()
          }),
      ),
    )
    nullsOrErrors.filter(e => !!e).forEach(e => this.logger.debug(e))
    clearInterval(statusId)
    this.logger.debug(
      `Prepared free sockets:`,
      this._agent.getCurrentStatus().freeSockets,
    )
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
          .map(r => (r && r.timings ? r.timings.phases.total : 'TT'))
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

  _maxRequestsPerWindow() {
    return Math.max(...this.requestsPerWindow)
  }

  async _sendRequests() {
    if (
      this.pendingRequests.length >
      this.maxOpenRequests - this._numRequestsThisTick()
    ) {
      this.logger.warn(
        `CAN'T HIT LOAD TARGET! Too many pending requests: ${
          this.pendingRequests.length
        }`,
      )
    } else {
      const newRequests = _.range(0, this._numRequestsThisTick()).map(i => {
        const url = this._urls[i % this._urls.length]
        const metadata = {
          url: url.toString(),
          tick: this._tick,
          window: this.windowSize,
          size: this._numRequestsThisTick(),
        }
        const { hostname, port } = url
        const requestOptions = {
          hostname,
          port,
          agent: this._agent,
          method: 'POST',
        }
        const request = https.request(requestOptions)
        const timings = hrtimer(request)
        request.once('response', res => {
          let data = ''
          res.on('data', chunk => {
            data += chunk
          })
          res.on('end', () => {
            this.pendingRequests.splice(
              this.pendingRequests.indexOf(request),
              1,
            )
            this.responses.push({
              ...metadata,
              timings: toMsTimings(timings, this._startTime),
              body: data,
            })
          })
          res.on('error', e => {
            this.pendingRequests.splice(
              this.pendingRequests.indexOf(request),
              1,
            )
            if (request.isCanceled) {
              this.errors.push({ ...metadata, canceled: true })
            } else {
              this.errors.push({ ...metadata, error: e.toString() })
              this.logger.warn(`${e}`)
            }
          })
        })
        request.end()
        return request
      })

      ;[].push.apply(this.pendingRequests, newRequests)
    }
  }
}
