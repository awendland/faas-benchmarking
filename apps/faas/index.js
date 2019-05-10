const initTime = Date.now()
let runCount = 0
const id = require('crypto')
  .randomBytes(16)
  .toString('base64')

module.exports.handler = async (event, context) => {
  const triggeredTime = Date.now()
  console.log(
    `run_count=${runCount++} init_time=${initTime} triggered_time=${triggeredTime}`,
  )
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
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      invokedFunctionArn: context.invokedFunctionArn,
      awsRequestId: context.awsRequestId,
    }),
  }
}
