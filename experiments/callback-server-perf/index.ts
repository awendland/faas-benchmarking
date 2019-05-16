import { fork } from 'child_process'
import CallbackServer from '../../apps/triggers/shared/callback-server'

// Load FaaS source directly to use real request bodies
const faasSrc = require('../../apps/faas/index')

const run = async () => {
  const [port, host] = [3001, '127.0.0.1']

  const server = new CallbackServer(port, host)
  await server.start()

  const autocannon = fork(__dirname + '/autocannon')
  autocannon.on('error', e => {
    throw e
  })
  autocannon.send({
    cmd: 'start',
    params: {
      url: `http://${host}:${port}`,
      connections: 500,
      duration: 30,
      method: 'POST',
      body: JSON.stringify(
        await faasSrc.handler({ triggeredTime: Date.now() }),
      ),
    },
  })
  const results = await new Promise(resolve => {
    autocannon.on('message', resolve)
  })
  autocannon.disconnect()

  await server.stop()

  console.log(results)
  console.log(
    `CallbackServer recorded ${
      server.requests.length
    } request and used ${process.memoryUsage().rss /
      (1024 * 1024)} MiB of memory`,
    server.requests[0],
  )
}

if (require.main === module) {
  run().catch(e => {
    console.error(e)
    process.exit(1)
  })
}
