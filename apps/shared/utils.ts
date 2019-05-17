import * as t from 'io-ts'
import { failure } from 'io-ts/lib/PathReporter'
import { ITeardownable } from './types'

/**
 * Decode a value using an io-ts type definition, and return the decoded value
 * or throw if there was a decoding error (with information about why it failed)
 *
 * @param value Value to decode
 * @param codec io-ts type definition to decode into
 */
export function decodeOrThrow<A, O, I>(value: I, codec: t.Type<A, O, I>): A {
  return codec.decode(value).getOrElseL(errors => {
    throw new Error(failure(errors).join('\n'))
  })
}

/**
 * Sleep for a given number of milliseconds (using a setTimeout call)
 *
 * @param ms Number of milliseconds to sleep for
 */
export const sleep = (ms: number) =>
  new Promise(res => setTimeout(() => res(), ms))

/**
 * Run a closure and teardown a resource upon it's completion, regardless of if
 * an error was thrown
 */
export const tryThenTeardown = async (
  resource: ITeardownable,
  fn: () => Promise<void>,
) => {
  try {
    await fn()
  } catch (e) {
    // FIX: this error should be propagating to higher levels and logging,
    // but it isn't
    console.error(`tryThenTeardown`, e)
    throw e
  } finally {
    await resource.teardown()
  }
}
