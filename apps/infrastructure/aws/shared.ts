import * as t from 'io-ts'
import * as Path from 'path'

/**
 * Path to the `serverless` command that is locally installed with this project,
 * (as opposed to the global one which might be the wrong version).
 */
export const serverlessBin = (() => {
  const serverlessFile = require.resolve('serverless')
  const prefix = serverlessFile.split('node_modules')[0]
  return Path.join(prefix, 'node_modules', '.bin', 'serverless')
})()
