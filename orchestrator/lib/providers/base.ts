type VmId = String & { __type: "VMId" }

type VM = {
  id: VmId,
  publicDNS: string,
}

type ObjStorageUri = String & { __type: "ObjStorageUri" }

type Provider = {
  ////////
  // VM //
  ////////
  vm: {
    createNode8Instance({
      initCmd: string,
    }): Promise<VM>

    destroyInstance(id: VmId): Promise<void>
  }

  //////////////////
  // Blob Storage //
  //////////////////
  objectStorage: {
    // TODO this should operate on streams
    uploadFile(name: string, data: ReadableStream): Promise<ObjStorageUri>
  }

  //////////
  // FaaS //
  //////////
  faas: {
    // TODO this should operate on streams
    prepareHandlerDir(sourceDir: string): Promise<string>

    createFunction({}): Promise<string>
  }
}
