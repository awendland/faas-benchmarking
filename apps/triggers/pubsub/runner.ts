import { IContext } from '../../shared/types'
import { IRunnerConstructor } from '../shared/types'
import { IPubsubFaasRunner, IPubsubFaasRunnerParams, IPubsubFaasRunnerTargets } from './types'

export default class PubsubFaasRunner
  implements IPubsubFaasRunner {
  public providerRunner: IPubsubFaasRunner

  constructor(
    public context: IContext,
    public params: IPubsubFaasRunnerParams,
    public targets: IPubsubFaasRunnerTargets,
  ) {
    const providerRunnerConstructor = {
      aws: require('./aws').default,
    }[this.context.provider.name] as IRunnerConstructor
    this.providerRunner = new providerRunnerConstructor(
      this.context,
      this.params,
      this.targets,
    )
  }

  setup(): Promise<void> {
    return this.providerRunner.setup()
  }

  run(): Promise<void> {
    return this.providerRunner.run()
  }

  teardown(): Promise<void> {
    return this.providerRunner.teardown()
  }
}
