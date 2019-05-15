const initTime = Date.now()
let runCount = 0
const id = require('crypto')
  .randomBytes(16)
  .toString('base64')

const delay = ms => new Promise(res => setTimeout(() => res(), ms))

module.exports.handler = async (event, context) => {
  const triggeredTime = Date.now()
  const { sleep } = event.queryStringParameters || {}
  console.log(
    `run_count=${runCount++} init_time=${initTime} triggered_time=${triggeredTime} sleep=${sleep}`,
  )
  if (sleep) {
    await delay(sleep)
  }
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id,
      runCount,
      triggeredTime,
      initTime,
      sleep,
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      invokedFunctionArn: context.invokedFunctionArn,
      awsRequestId: context.awsRequestId,
    }),
  }
}
