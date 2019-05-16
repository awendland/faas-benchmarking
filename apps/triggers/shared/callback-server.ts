import { EventEmitter } from 'events'
import * as http from 'http'
import * as t from 'io-ts'

export const RequestRecord = t.type({
  /**
   * Set immediately upon receiving the request, before any data is loaded
   */
  time: t.number,
  /**
   * Concatenation of anything that came through the socket's 'data' events
   */
  rawData: t.string,
  /**
   * Remote address of the client, according to the request socket
   */
  remoteAddress: t.string,
})
export type IRequestRecord = t.TypeOf<typeof RequestRecord>

/**
 * Setup an HTTP server to listen for incoming requests. Requests will
 * be logged upon receipt in CallbackServer.requests. No parsing will
 * occur for the requests, besides header information.
 *
 * The user of CallbackServer is expected to process the requests after
 * the server has finished processing. NOTE: there is no limit set on
 * how many requests the server can store, so memory usage may get
 * excessive.
 */
export default class CallbackServer extends EventEmitter {
  /**
   * Array of all the requests that the server received
   */
  public requests: IRequestRecord[] = []
  // Instance of the http server
  private server: http.Server | null = null

  /**
   * @param port - Which port to start the server on
   */
  constructor(public port: number = 3000, public host: string = '0.0.0.0') {
    super()
  }

  /**
   * Start listening for connections. The promise will resolve once the
   * server has registered in the listening state.
   */
  start(): Promise<void> {
    if (this.server) {
      return Promise.resolve()
    }
    this.server = http.createServer()
    this.server.on('request', (req, res) => {
      const time = Date.now()
      req.socket.setNoDelay()
      const { remoteAddress } = req.socket
      let rawData = ''
      req.on('data', (chunk: any) => {
        rawData += chunk
      })
      req.on('end', () => {
        res.statusCode = 200
        res.end()
        this.requests.push({
          time,
          rawData,
          remoteAddress,
        })
      })
    })
    return new Promise((resolve, reject) => {
      this.server!.listen(this.port, this.host, () => resolve())
    })
  }

  /**
   * Stop listening for connections and shut down the server
   */
  stop(): Promise<void> {
    if (this.server) {
      this.server.removeAllListeners('request')
      return new Promise((resolve, reject) => {
        this.server!.close(() => resolve())
        this.server = null
      })
    }
    return Promise.resolve()
  }
}
