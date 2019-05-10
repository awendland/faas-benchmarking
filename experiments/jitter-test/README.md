# Jitter Test

Sets up sequential TCP connections and measures the RTT on them.

Can be used as a:

* Library `const jitter = require('./index')` where it exposes:
  * `ping` which takes `address` (an IP address), `port` (80), `attempts` (10, # of pings to send), and `timeout` (5s, ms before giving up)
* CLI `node ./index.js alexwendland.com 20` (CLI doesn't accept other args)
* Lambda (all args are passed as query parameters in an HTTP GET request)
  * Managed w/ Serverless using `serverless deploy` and `serverless remove`

## Acknowledgements

Thanks to [apaszke/tcp-ping](https://github.com/apaszke/tcp-ping) for the bulk of the implementation.