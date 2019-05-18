/**
 * Scales msgPerSec to represent the number of messages to send in the given period. Will
 * return 0 if msgPerSec is undefined, and will return msgPerSec if incrementPeriod is
 * undefined.
 *
 * @param incrementPeriod
 * @param msgPerSec
 */
export const msgPerSecToPeriod = (
  incrementPeriod: number | undefined,
  msgPerSec: number | undefined,
): number => {
  if (!incrementPeriod) return msgPerSec || 0
  const scalar = incrementPeriod / 1000
  return (msgPerSec || 0) * scalar
}
