import AwsHttpsFaasOrchestrator from './orchestrator'

///////////////
// CLI Entry //
///////////////

if (require.main === module) {
  let orchestrator: AwsHttpsFaasOrchestrator
  ;(async () => {
    orchestrator = new AwsHttpsFaasOrchestrator(
      {
        region: 'us-east-1',
      },
      {
        projectName: 'test-1',
        numberOfFunctions: 100,
        memorySize: '128',
        runtime: 'node8',
        sourceDir: '../../../faas',
        timeout: 30,
      },
    )
    console.log(await orchestrator.setup())
    await orchestrator.teardown()
  })().catch(async e => {
    console.error(e)
    if (orchestrator) await orchestrator.teardown()
    process.exit(1)
  })
}
