import * as t from 'io-ts'
import * as tls from 'tls'
import * as https from 'https'
import { HttpsAgent as KeepAliveAgent } from 'agentkeepalive'
import { URL } from 'url'
const autocannon = require('autocannon')
import { IContext, IFaasResponse, IFaasParams } from '../../shared/types'
import {
  IHttpsRunnerParams,
  IHttpsRunnerTargets,
  HttpsRunnerTargets,
  HttpsRunnerParams,
} from './types'
import { sleep } from '../../shared/utils'
import { EventEmitter } from 'events'
import { IResultEvent, IRunner, IResult } from '../shared'

/*
 * So that this module conforms to:
 * {
 *  default: IOrchestratorConstructor,
 *  ParamsType: typeof default.params,
 *  TargetsType: typeof default.targets,
 * }
 */
export const ParamsType = HttpsRunnerParams
export const TargetsType = HttpsRunnerTargets

////////////////////////
// Autocannon Helpers //
////////////////////////

export const balanceConnectionPipelining = (requestsPerSecond: number) => {
  // assert(connections * connectionRate == requestsPerSecond)
  const PIPELINE_TARGET = 10
  let connections = Math.min(requestsPerSecond / PIPELINE_TARGET, 200)
  // Fallback to 1:1 connection:request mapping if non-integers pop up
  if (Math.floor(connections) !== connections) connections = requestsPerSecond
  return {
    connections,
    pipelining: requestsPerSecond / connections,
    connectionRate: requestsPerSecond / connections,
  }
}

//////////////////////
// Additional Types //
//////////////////////

export type IRequestId = string

export const RequestRecord = t.type({
  /**
   * If Autocannon:
   *  Set synthetically during the 'response' event from autocannon. Set to
   *  the current Date.now() - responseTime (from the autocannon event).
   * If https.request:
   *  Set immediately before calling write() then end() on the request.
   */
  startTime: t.number,
  /**
   * If Autocannon:
   *  Set synthetically during the 'response' event from autocannon. Set to
   *  the current Date.now().
   * If https.request:
   *  Set upon the first 'body' event.
   */
  endTime: t.number,
  /**
   * List of any Buffer data that came through the client's 'body' events
   */
  rawData: t.array(t.any),
})
export type IRequestRecord = t.TypeOf<typeof RequestRecord>

/**
 * Implementation of HttpsRunner.
 */
export default class HttpsRunner
  implements IRunner<IHttpsRunnerParams, IHttpsRunnerTargets> {
  private messageBody: string

  constructor(
    public context: IContext,
    public params: IHttpsRunnerParams,
    public targets: IHttpsRunnerTargets,
  ) {
    this.messageBody = JSON.stringify({
      ...this.params.faasParams,
    } as IFaasParams)
  }

  async setup() {}

  async run(): Promise<IResult> {
    let requests: IRequestRecord[]
    if (
      this.params.numberOfPeriods === 1 &&
      this.params.initialMsgPerSec === 1
    ) {
      requests = await this.runPrewarmedRequest()
    } else {
      requests = await this.runAutocannon()
    }
    // Decode results
    const events: IResultEvent[] = requests.map(request => {
      let faasData, invalidResponse
      if (request.rawData.length) {
        const httpReq = Buffer.concat(request.rawData)
          .toString('utf8')
          .split('\r\n\r\n')
        try {
          if (httpReq.length === 1) faasData = JSON.parse(httpReq[0])
          else faasData = JSON.parse(httpReq[1])
        } catch (e) {
          invalidResponse = httpReq.join('\r\n\r\n')
        }
      }
      return {
        startTime: request.startTime,
        endTime: request.endTime,
        response: faasData,
        invalidResponse,
      }
    })
    return {
      events,
    }
  }

  async teardown(): Promise<void> {
    /* noop */
  }

  private async runPrewarmedRequest(): Promise<IRequestRecord[]> {
    console.debug(`Using PrewarmedRequest instead of Autocannon`)
    const agent = new KeepAliveAgent({
      // Arbitrary large numbers
      freeSocketTimeout: 24 * 60 * 60 * 1e3,
      maxCachedSessions: 1e3,
      maxFreeSockets: 1e3,
      maxSockets: 1e3,
    })
    const url = new URL(this.targets.url)
    let { hostname, port } = url
    if (!port) port = url.protocol === 'https:' ? '443' : '80'
    await new Promise((resolve, reject) => {
      const reqOptions = { hostname, port, method: 'HEAD', agent }
      // TODO pre-warm TCP connection only, don't make full HTTP request
      const req = https.request(reqOptions, res => {
        res.resume()
        res.on('end', () => resolve())
      })
      req.on('error', err => reject(err))
      req.end()
    })
    console.debug(`Established connection to ${hostname}:${port}`)
    return await new Promise((resolve, reject) => {
      const requestOptions = {
        hostname,
        port,
        path: url.pathname,
        method: 'POST',
        agent,
      }
      const request = https.request(requestOptions)
      let startTime: number
      request.once('response', res => {
        let endTime: number
        const rawData: Buffer[] = []
        res.on('data', (chunk: Buffer) => {
          if (!endTime) endTime = Date.now()
          rawData.push(chunk)
        })
        res.on('error', (e: Error) => {
          throw e
        })
        res.on('end', () => {
          resolve([
            {
              startTime,
              endTime,
              rawData,
            },
          ])
        })
      })
      request.setNoDelay(true)
      startTime = Date.now()
      request.write(this.messageBody)
      request.end()
    })
  }

  private async runAutocannon(): Promise<IRequestRecord[]> {
    const requests: IRequestRecord[] = []
    const cannons: Array<EventEmitter & { stop: () => void }> = []
    const cannonDones: Array<Promise<any>> = []
    ;(tls as any).DEFAULT_ECDH_CURVE = 'auto'

    for (let period = 0; period < this.params.numberOfPeriods; ++period) {
      const periodStart = Date.now()

      // Setup a cannon to handle new capacity if need be
      if (period === 0 || this.params.incrementMsgPerSec) {
        const rateParams = balanceConnectionPipelining(
          period === 0
            ? this.params.initialMsgPerSec
            : this.params.incrementMsgPerSec!,
        )
        console.debug(
          `Starting new autocannon with connections=${
            rateParams.connections
          } each pipelined at ${rateParams.connectionRate} rps to ${
            this.targets.url
          }`,
        )
        const autocannonArgs = {
          url: this.targets.url,
          method: 'POST',
          servername: new URL(this.targets.url).hostname,
          ...rateParams,
          duration: 24 * 60 * 60, // 1 day (some non-overflowing but absurdly large number)
          // If only sending one round of connections, then impose a maxOverallRequests
          // so the 'done' event actually fires.
          maxOverallRequests:
            this.params.numberOfPeriods === 1
              ? this.params.initialMsgPerSec
              : undefined,
          body: this.messageBody,
          setupClient: (client: EventEmitter) => {
            // We assume that 'body' will be triggered (1+ times) and then
            // 'response' once after. This assumption may NOT be true, however,
            // this seems to match http-parser-js's implementation and
            // the definition of HTTP pipelining.
            let rawData: Buffer[] = []
            client.on('body', (body: Buffer) => {
              rawData.push(body)
            })
            client.on(
              'response',
              (statusCode: number, resBytes: number, responseTime: number) => {
                // Create a synthetic endTime and startTime, given the responseTime
                const endTime = Date.now()
                const startTime = endTime - Math.ceil(responseTime)
                requests.push({
                  startTime,
                  endTime,
                  rawData,
                })
                rawData = []
              },
            )
          },
        }
        console.debug(this.params, autocannonArgs)
        const cannon = autocannon(autocannonArgs, () => {})
        cannon.on('error', console.log)
        cannon.on('reqError', console.log)
        cannons.push(cannon)
        cannonDones.push(
          new Promise(resolve => {
            cannon.on('done', resolve)
          }),
        )
      }

      if (this.params.incrementPeriod) {
        const sleepTime =
          this.params.incrementPeriod - (Date.now() - periodStart)
        await sleep(sleepTime) // TODO this could lead to drift over time
      }
    }

    // Stop all cannons
    if (this.params.numberOfPeriods !== 1) {
      console.debug(`Terminating autocannons`)
      cannons.forEach(c => c.stop())
    }
    const cannonResults = await Promise.all(cannonDones)
    console.debug(
      `Average rps from autocannons: ${cannonResults.map(
        (r: any) => r.requests.average,
      )}`,
    )
    console.debug(
      `Number of requests sent from autocannons: ${cannonResults.map(
        (r: any) => r.requests.sent,
      )}`,
    )

    return requests
  }
}
