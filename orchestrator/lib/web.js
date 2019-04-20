const wretch = require('wretch')
const fetch = require('node-fetch')
const { performance, PerformanceObserver } = require('perf_hooks')

wretch().polyfills({
  fetch: function(url, opts) {
    performance.mark(url + ' - begin')
    return fetch(url, opts).then(_ => {
      performance.mark(url + ' - end')
      performance.measure(_.url, url + ' - begin', url + ' - end')
    })
  },
  performance: performance,
  PerformanceObserver: PerformanceObserver
  FormData: require('form-data'),
  URLSearchParams: require('url').URLSearchParams,
})

module.exports = wretch
