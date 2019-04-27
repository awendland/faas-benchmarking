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

MEM_SIZES = [128, 256, 512, 1024, 2048] # Taken from the GCP list and within AWS bounds
NUM_BURSTS = 13
BURST_START = 100
BURST_GROWTH = 100
RUNTIMES = ['Node8']

if __name__== "__main__":
    run_id = os.getenv('RUN_ID', utils.run_id())
    for runtime in RUNTIMES:
        for mem_size in MEM_SIZES:
            proj_name = 'scale-warm-{}-{}-{}'.format(run_id, mem_size, runtime).lower()
            print('\n[{}]'.format(proj_name))
            def init_urls():
                return utils.setup_infra(proj_name=proj_name,
                                         mem_size=mem_size,
                                         runtime=runtime,
                                         num_fns=1)
            urls = utils.fetch_checkpoint_or_run(proj_name, init_urls)
            window = 500
            utils.send_requests(filename='{}.results'.format(proj_name),
                                rpw=BURST_START,
                                req_growth=BURST_GROWTH,
                                window=window,
                                duration=NUM_BURSTS * window + (window * 0.5),
                                urls=urls)