'use strict'
const fs = require('fs')
const autocannon = require('autocannon')

const responseTimes = new Array(3e4)

const url = 'https://alexwendland.com'
const connections = 300
const pipelining = 15
const start = Date.now()

const instance = autocannon({
  url: 'https://alexwendland.com',
  connections,
  pipelining,
  duration: 3,
}, console.log)

// this is used to kill the instance on CTRL-C
process.once('SIGINT', () => {
  instance.stop()
})

instance.on('response', (client, statusCode, resBytes, responseTime) => {
  responseTimes.push(Date.now())
})

instance.once('done', () => {
  const validResponses = responseTimes.filter(t => !!t)
    
  const mockOutput = JSON.stringify(
    {
      responses: validResponses.map(t => ({
        url,
        tick: -1,
        window: -1,
        size: connections * pipelining,
        timings: {
          start,
          socket: 0,
          lookup: 0,
          connect: 0,
          upload: 0,
          response: t,
          end: 0,
        },
        body: '{}'
      })),
      errors: [],
    },
    null,
    2,
  )
  fs.writeFileSync(`${new Date().toISOString()}.mock.results`, mockOutput)
  fs.writeFileSync(`${new Date().toISOString()}.responses.results`, validResponses.join('\n'))
})
