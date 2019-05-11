const { execFile } = require('child_process')
const fs = require('fs')
const { promisify } = require('util')
const path = require('path')
const { performance } = require('perf_hooks')

const asyncExecFile = promisify(execFile)
const asyncReadDir = promisify(fs.readdir)

/**
 * Run the provided script with strace attached
 */
const straceScript = async (
  traceFilePrefix,
  scriptCmd,
  cwd,
) /* Promise<{traceFiles: fs.Stats[], stdout: string, stderr: string, runtime: number}> */ => {
  const start = performance.now()
  const {stdout, stderr} = await asyncExecFile('strace', [
    '-o', traceFilePrefix,
    // '-e', 'trace=file,network', // Trace all file and network activity
    '-s8192', // Show 8k output of each trace record
    '-ff', // Follow child processes
    '-ttt', // Print microsecond timestamps with each command
    'sh', '-c', scriptCmd
  ], {
    maxBuffer: 50 * 1024 * 1024, // Max amount of bytes allowed on stdout and stderr
    cwd,
    env: Object.assign({}, process.env),
  })
  const traceFiles = (await asyncReadDir(cwd)).filter(f => f.indexOf(traceFilePrefix) === 0)
  return {traceFiles, stdout, stderr, runtime: performance.now() - start}
}

module.exports.straceScript = straceScript