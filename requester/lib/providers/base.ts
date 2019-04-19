type VM = {}

type Provider = {
  createVM(): Promise<VM>
}
