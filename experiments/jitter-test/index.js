'use strict'
const net = require('net')
const dns = require('dns')
const util = require('util')

////////////////////////
// Library Definition //
////////////////////////

// Based on https://github.com/apaszke/tcp-ping

const pingCb = function(options, callback) {
  let i = 0
  const results = []
  options.address = options.address || 'localhost'
  options.port = options.port || 80
  options.attempts = options.attempts || 10
  options.timeout = options.timeout || 5000
  const check = function(options, callback) {
    if (i < options.attempts) {
      connect(
        options,
        callback
      )
    } else {
      let avg = results.reduce(function(prev, curr) {
        return prev + curr.time
      }, 0)
      const max = results.reduce(function(prev, curr) {
        return prev > curr.time ? prev : curr.time
      }, results[0].time)
      const min = results.reduce(function(prev, curr) {
        return prev < curr.time ? prev : curr.time
      }, results[0].time)
      avg = avg / results.length
      const out = {
        address: options.address,
        port: options.port,
        attempts: options.attempts,
        avg: avg,
        max: max,
        min: min,
        results: results,
      }
      callback(undefined, out)
    }
  }

  const connect = function(options, callback) {
    const s = new net.Socket()
    const start = process.hrtime()
    s.connect(options.port, options.address, function() {
      const time_arr = process.hrtime(start)
      const time = (time_arr[0] * 1e9 + time_arr[1]) / 1e6
      results.push({ seq: i, time: time })
      s.destroy()
      i++
      check(options, callback)
    })
    s.on('error', function(e) {
      results.push({ seq: i, time: undefined, err: e })
      s.destroy()
      i++
      check(options, callback)
    })
    s.setTimeout(options.timeout, function() {
      results.push({ seq: i, time: undefined, err: Error('Request timeout') })
      s.destroy()
      i++
      check(options, callback)
    })
  }
  connect(
    options,
    callback
  )
}

const ping = util.promisify(pingCb)
module.exports.pingCb = pingCb
module.exports.ping = ping

const resolveAndPingCb = (options, cb) => {
  const time_preDns = Date.now()

  const handleAddr = address => {
    console.log(
      `Resolved ${options.hostname} to ${address} in ${Date.now() -
        time_preDns}ms`
    )
    const time_prePing = Date.now()
    pingCb(
      {
        ...options,
        address,
      },
      (err, data) => {
        if (err) return cb(err)
        const pingElapsed = Date.now() - time_prePing
        console.log(`Pinged ${data.attempts} times in ${pingElapsed}ms`)
        console.log(data)
        const sumOfDiff2 = data.results.reduce(
          (acc, cur) => acc + Math.pow(cur.time - data.avg, 2),
          0
        )
        const stddev = Math.sqrt(sumOfDiff2 / data.results.length)
        const minJitter = data.min - data.avg
        const maxJitter = data.max - data.avg
        cb(null, {
          data,
          stddev,
          minJitter,
          maxJitter,
          hostname: options.hostname,
        })
      }
    )
  }

  if (options.address) handleAddr(options.address)
  else {
    dns.resolve4(options.hostname, (err, addresses) => {
      if (err) return cb(err)
      handleAddr(addresses[0])
    })
  }
}

const resolveAndPing = util.promisify(resolveAndPingCb)
module.exports.resolveAndPingCb = resolveAndPingCb
module.exports.resolveAndPing = resolveAndPing

///////////////
// CLI Entry //
///////////////

if (require.main === module) {
  const hostname = process.argv[2] || 'alexwendland.com'
  resolveAndPingCb(
    {
      hostname,
      attempts: parseInt(process.argv[3] || '20'),
    },
    (err, data) => {
      if (err) throw err
      console.log(`${data.data}
jitter
  dev=${data.stddev}
  min=${data.minJitter}
  max=${data.maxJitter}`)
    }
  )
}

//////////////////
// Lambda Entry //
//////////////////

module.exports.lambda = async event => {
  const data = await resolveAndPing(event.queryStringParameters)
  return {
    statusCode: 200,
    body: JSON.stringify(data, null, 2),
  }
}
