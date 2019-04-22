const got = require('got')

class HttpTriggerer {
  constructor(provider, {size, libVersion}) {
    this.provider = provider
    this.size = size
    this.libVersion = libVersion
    this.vm = null
  }

  async deploy() {
    this.vm = await this.provider.createNode8VM({
      initCmd: `
      mkdir /var/app
      cd /var/app
      curl ${libVersion} > lib.tar
      tar -xz -f lib.zip
      npm start
      `,
    })

    // Short delay to let the VM initialize/settle
    await new Promise(r => setTimeout(() => r(), 2000))

    return this
  }

  async teardown() {
    if (this.vm)
      await this.provider.destroyVM(vm.id)
  }

  async isReachable() {
    try {
      await got.get(`http://${this.vm.publicDNS}/health`)
      return true
    } catch(e) {
      return false
    }
  }
}
