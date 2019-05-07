const _ = require('lodash')

module.exports.FaasInstance = class FaasInstance {
  constructor(provider, params) {
    this.provider = provider
    this.params = params
    Object.assign(this, _.pick(params, ['name', 'runtime', 'size', 'timeout']))
  }

  /**
   * Deploy this FaasInstance to an HTTP accessible endpoint. The `url` field on this
   * instance will be populated after the deployment occurs.
   */
  async deploy() {
    const { url } = await this.provider.faas.createHttpFunction(this.params)
    this.url = url
    return this
  }

  /**
   * Check if this FaasInstance has been deployed
   */
  isDeployed() {
    return !!this.url
  }

  /**
   * Removes any infrastructure created for this FaasInstance.
   */
  async teardown() {
    if (this.url) this.provider.deleteFunction(this.name)
    return this
  }
}

module.exports.FaasFactory = class FaasFactory {
  /**
   * @param params Object defining { provider, handlerCode }
   */
  constructor(params) {
    Object.assign(this, params)
  }

  /**
   * Setup a FaaS factory on the given provider. This can be used to create new FaaS Instances
   * using the `build` method (those instances will need to be deployed after).
   *
   * In the case of AWS, this will upload the source code to S3 for Lambdas to be based on.
   */
  static async setup(
    provider,
    { name, sourceDir, handlerId } = { handlerId: 'index.handler' }
  ) {
    const handlerCode = await provider.faas.prepareHandlerCode(
      name,
      sourceDir,
      handlerId
    )
    return new FaasFactory({ provider, handlerCode })
  }

  /**
   * Create a new FaasInstance. This instance will need to be deployed by calling `deploy` on it.
   */
  build(functionParams) {
    return new module.exports.FaasInstance(this.provider, {
      ...functionParams,
      handlerCode: this.handlerCode,
    })
  }

  /**
   * Remove any infrastructure created for this factory, but will not remove any FaasInstances
   * that were created with it.
   */
  async teardown() {
    // if (this.handlerCode)
    //   this.provider.cleanupHandlerCode()
    return this
  }
}
