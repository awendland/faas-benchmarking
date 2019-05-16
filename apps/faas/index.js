const initTime = Date.now()
let runCount = 0
const id = require('crypto')
  .randomBytes(16)
  .toString('base64')

const http = require('http')

const delay = ms => new Promise(res => setTimeout(() => res(), ms))

module.exports.handler = async (event, context) => {
  const triggeredTime = Date.now()
  const { sleep, webhook } = event.queryStringParameters || {}
  console.log(
    `run_count=${runCount++} init_time=${initTime} triggered_time=${triggeredTime} sleep=${sleep}`,
  )
  if (sleep) {
    await delay(sleep)
  }
  const body = JSON.stringify({
    id,
    runCount,
    triggeredTime,
    initTime,
    sleep,
    functionName: context.functionName,
    functionVersion: context.functionVersion,
    invokedFunctionArn: context.invokedFunctionArn,
    awsRequestId: context.awsRequestId,
  })
  if (webhook) {
    await new Promise((resolve, reject) => {
      const request = http.request(
        {
          host: webhook,
          method: 'POST',
        },
        resp => {
          resp.resume()
          resp.on('error', reject)
          resp.on('end', resolve())
        },
      )
      request.write(body)
      request.end()
    })
  }
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  }
}
