import utils
import os
from pathlib import Path

NUM_TRIALS = 100
MEM_SIZES = [128] #, 512, 1024, 2048, 3192]
RUNTIMES = ['Node8']

if __name__== "__main__":
    run_id = os.getenv('RUN_ID', utils.run_id())
    for runtime in RUNTIMES:
        for mem_size in MEM_SIZES:
            proj_name = 'cold-start-{}-{}-{}'.format(run_id, mem_size, runtime).lower()
            def init_urls():
                return utils.setup_infra(proj_name=proj_name,
                                         mem_size=mem_size,
                                         runtime=runtime,
                                         num_fns=NUM_TRIALS)
            urls = utils.fetch_checkpoint_or_run(proj_name, init_urls)
            utils.send_requests(filename=proj_name + '.results',
                                rpw=NUM_TRIALS,
                                window=10000,
                                duration=500,
                                urls=urls)