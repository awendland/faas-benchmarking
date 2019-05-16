const autocannon = require('autocannon')

// Run autocannon
process.on('message', (msg) => {
  if (msg.cmd === 'start') {
    autocannon(msg.params, (err, results) => {
      if (err) throw err
      process.send(results)
    })
  }
})
