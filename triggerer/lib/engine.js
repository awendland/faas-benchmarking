const _ = require('lodash')
const got = require('got')

class HttpEngine {
  // Get TCP RTT using https://nodejs.org/api/net.html#net_event_connect
  constructor({
    windowSize,
    requestsPerWindow,
    requestPayload, // TODO use this? maybe make it work like requestUrls
    requestUrls,
    logger,
  }) {
    this.windowSize = windowSize
    this.requestsPerWindow = requestsPerWindow
    this.requestPayload = requestPayload
    this.requestUrls = requestUrls

    this.http = got.create() // Removes defaults like following redirects

    this.running = false
    this.timeoutId = null
  }

  run() {
    this.shouldRun = true
    this._runWindow()
  }

  stop() {
    this.shouldRun = false
    this._cancelWindow()
    // TODO consider making requests abortable
    // https://github.com/sindresorhus/got#aborting-the-request
  }

  _cancelWindow() {
    if (this.timeoutId) {
      cancelTimeout(this.timeoutId)
      return true
    }
    return false
  }

  _scheduleWindow(sleep = 0) {
    if (!this.timeoutId && this.shouldRun) {
      this.timeoutId = setTimeout(() => {
        this.timeoutId = null
        this._runWindow()
      }, sleep)
      return true
    }
    return false
  }

  async _runWindow() {
    const windowStart = Date.now()
    requests = _.range(0, this.requestsPerWindow)
      .map(async (i) => {
        const url = this.requestUrls[i % this.requestUrls.length]
        const { response, timings} = await this.http.get(url)
        return { url, timing }
      })
    timings = await promise.all(requests)
    // TODO All requests are done, record numbers and stuff
    const elapsed = Date.now() - windowStart
    const sleep = this.windowSize - elapsed
    // TODO handle if it can't send enough requests per window
    this.scheduleWindow(sleep)
  }

}
