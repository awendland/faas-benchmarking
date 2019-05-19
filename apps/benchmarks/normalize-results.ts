import { IResultEvent } from '../triggers/shared/types'
import * as fs from 'fs'

export type GraphFormatResponses = {
  id: string
  runCount: number
  triggeredTime: number
  initTime: number
  startTime: number
  endTime: number
  processingTime: number
}

export type GraphFormat = {
  params: {
    memorySize: string
    triggerType: string
    initRate: number | null
    incrementSize: number | null
    incrementPeriod: number | null
  }
  responses: Array<GraphFormatResponses>
}

export type BenchmarkFormat = {
  time: string
  data: {
    memorySize: string
    results: {
      events: IResultEvent[]
    }
  }
}

///////////////
// CLI Entry //
///////////////

const argv = require('minimist')(process.argv.slice(2))
const filename = argv._[0]

const file = fs.readFileSync(filename, 'utf8')

let params
const responses: GraphFormatResponses[] = []

for (const line of file.split('\n').filter(l => l.trim().length > 0)) {
  const trialRun: BenchmarkFormat = JSON.parse(line)
  if (!params) {
    params = {
      memorySize: trialRun.data.memorySize,
      triggerType: (trialRun.data as any).triggerType || 'pubsub',
      initRate: (trialRun.data as any).initRate || null,
      incrementSize: (trialRun.data as any).incrementSize || null,
      incrementPeriod: (trialRun.data as any).incrementPeriod || null,
    }
  }
  let numberOfErrors = 0
  for (const event of trialRun.data.results.events) {
    if (!event.response) {
      numberOfErrors++
      continue
    }
    responses.push({
      id: event.response.id,
      runCount: event.response.runCount,
      triggeredTime: event.response.triggeredTime,
      processingTime: (event.response as any).processingTime || 0,
      initTime: event.response.initTime,
      startTime: event.startTime,
      endTime: event.endTime,
    })
  }
  console.log(`Omitted ${numberOfErrors} requests with invalid response bodies`)
}

const output: GraphFormat = {
  params: params!,
  responses,
}

fs.writeFileSync(`${filename}.norm`, JSON.stringify(output, null, 2))
