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

/**
 * Path to the `serverless-plugin-split-stacks` installation folder, to
 * be symlinked to by the serverless temp directory.
 */
export const serverlessPluginSplitStacksDir = Path.dirname(
  require.resolve('serverless-plugin-split-stacks'),
)
