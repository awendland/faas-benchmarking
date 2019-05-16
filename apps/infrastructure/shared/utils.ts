import * as t from 'io-ts'
import { failure } from 'io-ts/lib/PathReporter'

export function decodeOrThrow<A, O, I>(value: I, codec: t.Type<A, O, I>): A {
  return codec.decode(value).getOrElseL(errors => {
    throw new Error(failure(errors).join('\n'))
  })
}
