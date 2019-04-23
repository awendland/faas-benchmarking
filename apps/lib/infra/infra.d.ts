type Teardownable = {
  teardown(): Promise<void>
}

type VmId = String & { __type: "VMId" }

type VM = {
  id: VmId,
  publicDNS: string,
}

type ObjStorageUri = String & { __type: "ObjStorageUri" }

type FunctionSize = 128 | 256 | 512 | 1024 | 2048 | 3072
type FunctionRuntime = 'Node8'

type FunctionName = String & { __type: "FunctionName" }
type FunctionHttpUrl = String & { __type: "FunctionHttpUrl" }

type Provider<HandlerCode> = {
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
    /**
     * Prepare a directory of source code containing a handler for usage in a FaaS function for
     * this provider.
     *
     * For AWS Lambda, this means uploading the source code to S3 to make it available.
     *
     * This will return a Provider specific object representing the handler code, to be used
     * with createHttpFunction().
     */
    prepareHandlerCode(name: string, sourceDir: string, handlerId: string): Promise<HandlerCode>

    // TODO figure out proper abstraction for different trigger types (not just HTTP)
    // returns FaaS HTTP trigger URL
    createHttpFunction(p: {
      handlerCode: HandlerCode,
      name: string,
      size: FunctionSize,
      runtime: FunctionRuntime,
      timeout: number,
    }): Promise<string>

    deleteFunction(name: FunctionName): Promise<void>

    publishHttpFunctions(): Promise<{ name: FunctionName, url: string }>
  }
}
