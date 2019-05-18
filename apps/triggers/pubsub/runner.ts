import { IProvider, IContext } from '../../shared/types'
import { IRunnerConstructor } from '../shared/types'
import {
  IPubsubFaasRunner,
  IPubsubFaasRunnerParams,
  IPubsubFaasRunnerTargets,
  PubsubFaasRunnerTargets,
  PubsubFaasRunnerParams,
} from './types'

/*
 * So that this module conforms to:
 * {
 *  default: IOrchestratorConstructor,
 *  ParamsType: typeof default.params,
 *  TargetsType: typeof default.targets,
 * }
 */
export const ParamsType = PubsubFaasRunnerParams
export const TargetsType = PubsubFaasRunnerTargets

/**
 *
 */
export default class PubsubFaasRunner implements IPubsubFaasRunner {
  public providerRunner: IPubsubFaasRunner

  constructor(
    public context: IContext,
    public params: IPubsubFaasRunnerParams,
    public targets: IPubsubFaasRunnerTargets,
  ) {
    const providerRunnerConstructor: IRunnerConstructor = {
      aws: require('./aws').default,
    }[this.context.provider.name as IProvider]
    this.providerRunner = new providerRunnerConstructor(
      this.context,
      this.params,
      this.targets,
    )
  }

  setup() {
    return this.providerRunner.setup()
  }

  run() {
    return this.providerRunner.run()
  }

  teardown() {
    return this.providerRunner.teardown()
  }
}
