const { straceScript } = require('./lib')
const fs = require('fs')

///////////////
// CLI Entry //
///////////////

if (require.main === module) {
  ;(async () => {
    const runId = new Date().toISOString()
    const workDir = `results-${runId}`
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir)
    }
    const cmd = `node ../../../deprecated/apps/engine_runner.js --urls https://alexwendland.com --window-size 10000 --duration 1000 --rpw 10`
    await straceScript(`traces`, cmd, workDir)
  })().catch(e => {
    console.error(e.stack)
    process.exit(1)
  })
}
