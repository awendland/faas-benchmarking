# FaaS Benchmarking

## Overview

TODO

## Structure

### `analysis/`

Contains code for analyzing test results. Primarily written in Python.

The main program for generating graphs is `graph.py` which can be run with `python3 parser.py $FILES $GRAPH_TYPE --other-params`. An example would be `python3 graph.py ../results/some-result.json cdf`.

Additional programs exist for analysis, such as `*.ipynb` files that have been used to explore results.

A `requirements.txt` lists the Python dependencies.

Altair also needs to be setup with Jupyter follwing the [Altair + Jupyter Quickstart](https://altair-viz.github.io/getting_started/installation.html#quick-start-altair-notebook).

Also, Python must be at least Python 3.6.

### `apps/`

Contains code for generating infrastructure and running load tests. Primarily written in Javascript.

Dependencies are managed by Yarn in the root of this repo (not in `apps/`), and can be installed with `yarn install`.

`engine_runner.js` can be executed using `node engine_runner.js`. Review the source code to see CLI args. This program is a temporary way to run the HTTP load generator (before the full architecture is complete). In general, it supports:
* Sending $RPW requests per window
* Scheduling windows every $WINDOW milliseconds.
* Cycling through URLs to target round-robin style.

`infra_setup_runner.js` can be executed using `node infra_setup_runner.js`. Review the source code to see CLI args. This program is a temporary way to setup AWS FaaS infrastructure for tests. In general it supports:
* Setting up Lambdas with API Gateway proxying HTTP requests.
* Setting up 1-N Lambdas.

### `test_runs/`

Contains code for orchestrating tests. Each file (excluding `utils.py`) is a test orchestrator that will leverage programs in `apps/` to run different FaaS microbenchmarks.
* Results will be written to a file with the test name, the run ID, the FaaS memory size, and the FaaS runtime used.
  * Run IDs are based on the number of minutes since an epoch, and therefore are incrementing (two of the same test can't be run in the same minute, without renaming the output of the previous test).
* Infrastructure created (and yet to be destroyed) will be stored in a checkpoint file. This infrastructure will be re-used by subsequent executions with the same run ID (this can be leveraged to debug benchmarking components).

Run a test with `python3 ../test_runs/cold_start_suite.py` (assuming you're in a subfolder, like `results/` where you want the output to be saved).

### `experiments/`

Contains self-contained ad-hoc lil' experiments (for testing things like network jitter or SNTP). Primarily written in node.js. Each experiment _should_ (hopefully) have a Readme file with it.
