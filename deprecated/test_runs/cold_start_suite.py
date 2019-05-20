import utils
import os
from pathlib import Path

# To cleanup lambdas:
# aws lambda list-functions
#   | jq '.Functions[].FunctionName' -r
#   | grep '$RUN_ID_TO_DELETE'
#   | parallel -j4 'aws lambda delete-function --function-name {} && echo "{}"'
#
# To cleanup API gateways:
# aws apigateway get-rest-apis
#   | jq '.items[] | "\(.name)\t\(.id)"' -r
#   | grep "test\t"
#   | awk '{print $2}'
#   | parallel -j1 'aws apigateway delete-rest-api --rest-api-id {}; echo {}; sleep 60'

NUM_TRIALS = 290 # API Gateway only allows 300 resources per REST API
MEM_SIZES = [128, 256, 512, 1024, 2048] # Taken from the GCP list and within AWS bounds
RUNTIMES = ['Node8']

if __name__== "__main__":
    run_id = os.getenv('RUN_ID', utils.run_id())
    for runtime in RUNTIMES:
        for mem_size in MEM_SIZES:
            proj_name = 'cold-start-{}-{}-{}'.format(run_id, mem_size, runtime).lower()
            print('\n[{}]'.format(proj_name))
            def init_urls():
                return utils.setup_infra(proj_name=proj_name,
                                         mem_size=mem_size,
                                         runtime=runtime,
                                         num_fns=NUM_TRIALS)
            urls = utils.fetch_checkpoint_or_run(proj_name, init_urls)
            utils.send_requests(filename=proj_name + '.results',
                                rpws=[NUM_TRIALS],
                                window=10000,
                                duration=500,
                                urls=urls)