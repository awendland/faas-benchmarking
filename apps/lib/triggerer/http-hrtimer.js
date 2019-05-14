// Fork of https://github.com/szmarczak/http-timer/blob/master/source/index.ts
// that uses process.hrtime instead of Date.now()
const { EventEmitter } = require('events')
const { Socket } = require('net')
const { ClientRequest, IncomingMessage } = require('http')
// @ts-ignore
const deferToConnect = require('defer-to-connect')

/*
export interface HrTimings {
  start: [number, number];
  socket?: [number, number];
  lookup?: [number, number];
  connect?: [number, number];
  upload?: [number, number];
  response?: [number, number];
  end?: [number, number];
  error?: [number, number];
  phases: {
    wait?: [number, number];
    dns?: [number, number];
    tcp?: [number, number];
    request?: [number, number];
    firstByte?: [number, number];
    download?: [number, number];
    total?: [number, number];
  };
}
*/

/*
export interface MsTimings {
  start: number;
  socket?: number;
  lookup?: number;
  connect?: number;
  upload?: number;
  response?: number;
  end?: number;
  error?: number;
  phases: {
    wait?: number;
    dns?: number;
    tcp?: number;
    request?: number;
    firstByte?: number;
    download?: number;
    total?: number;
  };
}
*/

const diffHrtime = function(
  b /*: [number, number]*/,
  a /*: [number, number]*/,
) {
  const [as, ans] = a,
    [bs, bns] = b
  let ns = ans - bns, // nanosecs delta, can overflow (will be negative)
    s = as - bs // secs delta
  if (ns < 0) {
    // has overflowed
    s -= 1 // cut a second
    ns += 1e9 // add a billion nanosec (to neg number)
  }
  return [s, ns]
}

const hrToMs = (hrtime /*: [number, number]*/) /*: number*/ =>
  hrtime[0] * 1e3 + hrtime[1] / 1e6

/**
 * Convert a HrTimings object into a MsTimings object. Since process.hrtimes can
 * overflow JavaScript's numbers, an arbitrary reference point must be provided
 * from the recent past which the millisecond values will be offsets of.
 */
module.exports.toMsTimings = (
  obj /*: HrTimings | typeof HrTimings.phases */,
  refTime /*: []*/,
) /*: MsTimings */ =>
  Object.entries(obj)
    .map(([k, v]) => {
      if (Array.isArray(v)) return [k, hrToMs(diffHrtime(refTime, v))]
      if (!v || typeof v === 'number') return [k, v]
      return [k, module.exports.toMsTimings(v, [0, 0])]
    })
    .reduce((obj, [k, v]) => Object.assign(obj, { [k]: v }), {})

/**
 * Add listeners to a request to collect all the associated timings. This will
 * immediately return a timings object, however, that object will not be fully
 * populated until the response triggers the 'end' or 'error' event.
 */
module.exports.default = (request /*: ClientRequest*/) /*: HrTimings*/ => {
  const timings /*: HrTimings*/ = {
    start: process.hrtime(),
    socket: undefined,
    lookup: undefined,
    connect: undefined,
    upload: undefined,
    response: undefined,
    end: undefined,
    error: undefined,
    phases: {
      wait: undefined,
      dns: undefined,
      tcp: undefined,
      request: undefined,
      firstByte: undefined,
      download: undefined,
      total: undefined,
    },
  }

  const handleError = (origin /*: EventEmitter*/) /*: void*/ => {
    const emit = origin.emit.bind(origin)
    origin.emit = (event, ...args) => {
      // Catches the `error` event
      if (event === 'error') {
        timings.error = process.hrtime()
        timings.phases.total = process.hrtime(timings.start)

        origin.emit = emit
      }

      // Saves the original behavior
      return emit(event, ...args)
    }
  }

  let uploadFinished = false
  const onUpload = () /*: void*/ => {
    timings.upload = process.hrtime()
    timings.phases.request = process.hrtime(timings.connect)
  }

  handleError(request)

  request.once('socket', (socket /*: Socket*/) /*: void*/ => {
    timings.socket = process.hrtime()
    timings.phases.wait = process.hrtime(timings.start)

    const lookupListener = () /*: void*/ => {
      timings.lookup = process.hrtime()
      timings.phases.dns = process.hrtime(timings.socket)
    }

    socket.once('lookup', lookupListener)

    deferToConnect(socket, () => {
      timings.connect = process.hrtime()

      if (timings.lookup === undefined) {
        socket.removeListener('lookup', lookupListener)
        timings.lookup = timings.connect
        timings.phases.dns = process.hrtime(timings.socket)
      }

      timings.phases.tcp = process.hrtime(timings.lookup)

      if (uploadFinished && !timings.upload) {
        onUpload()
      }
    })
  })

  request.once('finish', () => {
    uploadFinished = true

    if (timings.connect) {
      onUpload()
    }
  })

  request.once('response', (response /*: IncomingMessage*/) /*: void*/ => {
    timings.response = process.hrtime()
    timings.phases.firstByte = process.hrtime(timings.upload)

    handleError(response)

    response.once('end', () => {
      timings.end = process.hrtime()
      timings.phases.download = process.hrtime(timings.response)
      timings.phases.total = process.hrtime(timings.start)
    })
  })

  return timings
}
