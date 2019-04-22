class FaaSInstance {
  constructor(provider, {name, sourceZipPath, trigger}) {
  }

  static async build(provider, {name, sourceDirPath, trigger}) {
    return new FaaSInstance(provider, {
      name,
      sourceZipPath: await provider.prepareFaaSDir(sourceDirPath),
      trigger: trigger,
    })
  }

  async deploy() {
    sourceUri = await this.provider.uploadFile('TODO', fs.createReadStream(this.sourceZipPath))
    // TODO deploy lambda
  }

  async teardown() {
  }
}
