const { EventEmitter } = require('events')
const net = require('net')
const tls = require('tls')
const { HTTPParser } = require('http-parser-js')
const { requestBuilder } = require('./http-request-builder')

class HttpConnection extends EventEmitter {
  /**
   * @param opts.protocol https
   * @param opts.port 443
   * @param opts.hostname alexwendland.com
   * @param opts.secure true
   */
  constructor(opts) {
    super()
    Object.assign(this, opts)
    this.secure = this.secure || this.protocol === 'https:'
    if (this.secure && this.port === 80) this.port = 443
    if (!this.port) this.port = this.secure ? 443 : 80

    this._responseListeners = []
    this._responses = []
    this._curPipeIdx = 0 // To be used for pipelining, in the future

    this._requestBuilder = requestBuilder({
      hostname: this.hostname,
      port: this.port,
    })
    this._parser = new HTTPParser(HTTPParser.RESPONSE)

    this._parser[HTTPParser.kOnHeaders] = () => {}
    this._parser[HTTPParser.kOnHeadersComplete] = headers => {
      const resp = this._responses[this._curPipeIdx]
      resp.timings.response = process.hrtime()
      this.emit('headers', headers)
      resp.headers = headers
    }
    this._parser[HTTPParser.kOnBody] = body => {
      this.emit('body', body)
      this._responses[this._curPipeIdx].body = body
    }
    this._parser[HTTPParser.kOnMessageComplete] = () => {
      const resp = this._responses[this._curPipeIdx]
      resp.timings.end = process.hrtime()
      this.emit('response', resp)
      this._responseListeners[this._curPipeIdx]()
      console.log('message parsed')
      // Handle pipelining stuff like sending more requests or checking limits
    }
  }

  connect() {
    if (this.conn) Promise.resolve()
    return new Promise((resolve, reject) => {
      const onConnect = () => {
        resolve(this)
      }
      if (this.secure) {
        this.conn = tls.connect(
          this.port,
          this.hostname,
          {
            rejectUnauthorized: false,
            servername: this.servername,
          },
          onConnect,
        )
      } else {
        this.conn = net.connect(this.port, this.hostname, onConnect)
      }
      this.conn.on('data', chunk => {
        this._parser.execute(chunk)
      })
      this.conn.on('error', e => {
        delete this.conn
        reject(e)
      })
    })
  }

  request(request) {
    return new Promise((resolve, reject) => {
      // TODO implement timeout handling
      console.log('new request')
      const httpRequest = this._requestBuilder(request)
      this.conn.write(httpRequest)
      const resp = {}
      resp.timings = { connect: process.hrtime(), phases: {} }
      // TODO handle pipelining
      this._responseListeners[this._curPipeIdx] = () => {
        resolve(resp)
      }
      this._responses[this._curPipeIdx] = resp
    })
  }

  destroy() {
    this.conn.removeAllListeners('error')
    this.conn.removeAllListeners('end')
    this.conn.destroy()
  }
}

module.exports.HttpConnection = HttpConnection
