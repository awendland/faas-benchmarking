const initTime = Date.now()
let runCount = 0
const id = require('crypto')
  .randomBytes(16)
  .toString('base64')
  .replace('==', '')

/////////////
// Imports //
/////////////

const http = require('http')
const url = require('url')

///////////
// Utils //
///////////

const delay = ms => new Promise(res => setTimeout(() => res(), ms))

//////////////////////
// Standard Handler //
//////////////////////

module.exports.handler = async args => {
  const { triggeredTime, requestId, sleep, webhook, ...providerData } = args
  process.stdout.write(
    `run_count=${runCount++} init_time=${initTime} triggered_time=${triggeredTime} sleep=${sleep} webhook=${webhook}\n`,
  )
  if (sleep) {
    await delay(sleep)
  }
  const body = JSON.stringify({
    id,
    initTime,
    runCount,
    triggeredTime,
    requestId,
    sleep,
    webhook,
    providerData,
  })
  if (webhook) {
    await new Promise((resolve, reject) => {
      // TODO better socket timing (open socket, then record time and send HTTP request manually, with updated time)
      const request = http.request(
        {
          method: 'POST',
          ...url.parse(webhook),
          timeout: 3 * 1000,
        },
        resp => {
          resp.resume()
          resp.on('error', reject)
          resp.on('end', resolve)
        },
      )
      request.on('timeout', () => {
        request.abort();
      })
      request.write(body)
      request.end()
    })
  }
  return body
}

////////////////////////
// Trigger Interfaces //
////////////////////////

// AWS

/**
 * Pull interested details out of the AWS context to return to the caller
 */
const awsExtractContextDetails = context => ({
  functionName: context.functionName,
  functionVersion: context.functionVersion,
  invokedFunctionArn: context.invokedFunctionArn,
  awsRequestId: context.awsRequestId,
})

/**
 * Handler for AWS API Gateway.
 *
 * NOTE: LAMBDA_PROXY configuration is expected.
 */
module.exports.aws_https = async (event, context) => {
  const triggeredTime = Date.now()
  const body = await module.exports.handler({
    ...(event.queryStringParameters || {}),
    ...awsExtractContextDetails(context),
    triggeredTime,
  })
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  }
}

/**
 * Handler for AWS SQS
 *
 * NOTE: A batch size of 1 is expected.
 */
module.exports.aws_pubsub = async (event, context) => {
  const triggeredTime = Date.now()
  const body = await module.exports.handler({
    ...JSON.parse(event.Records[0].body),
    ...awsExtractContextDetails(context),
    triggeredTime,
  })
  return
}
