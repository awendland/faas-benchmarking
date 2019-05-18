import * as t from 'io-ts'
import autocannon from 'autocannon'
import { IContext, IFaasResponse, IFaasParams } from '../../shared/types'
import { IHttpsRunnerParams, IHttpsRunnerTargets } from './types'
import { sleep } from '../../shared/utils'
import { EventEmitter } from 'events'
import { IResultEvent, IRunner, IResult } from '../shared'

////////////////////////
// Autocannon Helpers //
////////////////////////

export const balanceConnectionPipelining = (requestsPerSecond: number) => {
  // assert(connections * connectionRate == requestsPerSecond)
  const PIPELINE_TARGET = 10
  const connections = Math.max(requestsPerSecond / PIPELINE_TARGET, 200)
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
   * Set synthetically during the 'response' event from autocannon. Set to
   * the current Date.now() - responseTime (from the autocannon event).
   */
  startTime: t.number,
  /**
   * Set synthetically during the 'response' event from autocannon. Set to
   * the current Date.now().
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
    const requests: IRequestRecord[] = []
    const cannons: Array<EventEmitter & { stop: () => void }> = []

    for (let period = 0; period < this.params.numberOfPeriods; ++period) {
      const periodStart = Date.now()

      // Setup a cannon to handle new capacity if need be
      if (this.params.incrementMsgPerSec) {
        const rateParams = balanceConnectionPipelining(
          period === 0
            ? this.params.initialMsgPerSec
            : this.params.incrementMsgPerSec,
        )
        console.debug(
          `Starting new autocannon with connections=${
            rateParams.connections
          } each pipelined at ${rateParams.connectionRate} rps to ${
            this.targets.url
          }`,
        )
        const cannon = autocannon(
          {
            url: this.targets.url,
            ...rateParams,
            duration: Number.POSITIVE_INFINITY,
            body: this.messageBody,
            setupClient: client => {
              // We assume that 'body' will be triggered (1+ times) and then
              // 'response' once after. This assumption may NOT be true, however,
              // this seems to match http-parser-js's implementation and
              // the definition of HTTP pipelining.
              const rawData: Buffer[] = []
              client.on('body', (body: Buffer) => {
                rawData.push(body)
              })
              client.on(
                'response',
                (
                  statusCode: number,
                  resBytes: number,
                  responseTime: number,
                ) => {
                  // Create a synthetic endTime and startTime, given the responseTime
                  const endTime = Date.now()
                  const startTime = endTime - responseTime
                  requests.push({
                    startTime,
                    endTime,
                    rawData,
                  })
                },
              )
            },
          },
          () => {},
        )
        cannons.push(cannon as any)
      }

      if (this.params.incrementPeriod) {
        const sleepTime =
          this.params.incrementPeriod - (Date.now() - periodStart)
        await sleep(sleepTime) // TODO this could lead to drift over time
      }
    }

    // Stop all cannons
    const cannonResults = Promise.all(
      cannons.map(
        c =>
          new Promise(resolve => {
            c.on('done', resolve)
          }),
      ),
    )
    cannons.forEach(c => c.stop())
    console.debug(
      `Average rps from autocannons: ${(await cannonResults).map(
        (r: any) => r.requests.average,
      )}`,
    )

    // Decode results
    const events: IResultEvent[] = requests.map(request => {
      const faasData: IFaasResponse = JSON.parse(
        Buffer.concat(request.rawData).toString('utf8'),
      )
      return {
        startTime: request.startTime,
        endTime: request.endTime,
        response: faasData,
      }
    })
    return {
      events,
    }
  }

  async teardown(): Promise<void> {
    /* noop */
  }
}
