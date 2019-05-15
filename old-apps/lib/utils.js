module.exports.sleep = timeMs =>
  new Promise(res => {
    setTimeout(() => res(), timeMs)
  })
