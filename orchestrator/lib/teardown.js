/**
 * Trigger `teardown` on all provided items. If their teardown function also has to deal with
 * teardowns internally, and conforms to this function's spec of throwing a list of all the errors,
 * then all the errors will be flatMapped and thrown
 * at the top level.
 */
module.exports.handleTeardowns = async (teardowns) => {
  failed = []
  teardowns.forEach(t => {
    try {
      await t.teardown()
    } catch(e) {
      failed = failed.concat(e)
    }
  })
  if (failed.length > 0)
    throw failed
}
