import * as t from 'io-ts'

///////////////
// Providers //
///////////////

export const Provider = t.keyof({
  aws: null,
})
export type IProvider = t.TypeOf<typeof Provider>

/////////
// AWS //
/////////

export const AwsParams = t.exact(
  t.type({
    region: t.string,
  }),
)
export type IAwsParams = t.TypeOf<typeof AwsParams>

export const AwsContext = t.type({
  name: t.literal('aws'),
  params: AwsParams,
})
export type IAwsContext = t.TypeOf<typeof AwsContext>

export const liftAwsContext = (caller: string, context: IContext): IAwsContext => {
  if (context.provider.name !== 'aws') {
    throw new Error(`${caller} was provider a context for "${context.provider.name}" instead of "aws"`)
  }
  return context.provider
}

/////////
// GCP //
/////////

// NOTE: this isn't implemented yet!!! (and isn't in the Provider list)

export const GcpParams = t.exact(
  t.type({
    region: t.string,
  }),
)
export type IGcpParams = t.TypeOf<typeof GcpParams>

export const GcpContext = t.type({
  name: t.literal('gcp'),
  params: GcpParams,
})

/////////////
// Context //
/////////////

export const ProviderContext = t.taggedUnion('name', [AwsContext, GcpContext])
export type IProviderContext = t.TypeOf<typeof ProviderContext>

export const Context = t.type({
  projectName: t.string,
  provider: ProviderContext,
})
export type IContext = t.TypeOf<typeof Context>
