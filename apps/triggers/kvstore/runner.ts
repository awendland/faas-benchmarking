import { IProvider, IContext } from '../../shared/types'
import { IRunnerConstructor } from '../shared/types'
import {
  IKvstoreFaasRunner,
  IKvstoreFaasRunnerParams,
  IKvstoreFaasRunnerTargets,
  KvstoreFaasRunnerTargets,
  KvstoreFaasRunnerParams,
} from './types'

/*
 * So that this module conforms to:
 * {
 *  default: IOrchestratorConstructor,
 *  ParamsType: typeof default.params,
 * }
 */
export const ParamsType = KvstoreFaasRunnerParams
export const TargetsType = KvstoreFaasRunnerTargets

/**
 *
 */
export default class KvstoreFaasRunner implements IKvstoreFaasRunner {
  public providerRunner: IKvstoreFaasRunner

  constructor(
    public context: IContext,
    public params: IKvstoreFaasRunnerParams,
    public targets: IKvstoreFaasRunnerTargets,
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
