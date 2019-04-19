const express = require('express')
const { decorateApp } = require('@awaitjs/express')

run().catch(error => console.error(error.stack))

const app = decorateApp(express())

async function run() {
  const port = parseInt(process.env['PORT']) || 3000

  app.postAsync('/setup', async (req, res) => {
    // TODO
    res.send({})
  })

  app.postAsync('/start', async (req, res) => {
    // TODO
    res.send({})
  })

  app.getAsync('/status', async (req, res) => {
    // TODO
    res.send({})
  })

  app.postAsync('/stop', async (req, res) => {
    // TODO
    res.send({})
  })

  /**
   * Close all open sockets and reset all state
   */
  app.postAsync('/reset', async (req, res) => {
    // TODO
    res.send({})
  })

  app.postAsync('/shutdown', async (req, res) => {
    res.send(JSON.stringify({msg: 'Shutting down'}))
    await server.close()
  })

  const server = await app.listen(port, () => console.log(`Control server on port ${port}!`))
}
