# FaaS Benchmarking

## Overview

A WIP benchmarking framework for evaluating the latency overhead that FaaS systems introduce as well as the scaling elasticity that they provide. Intended to help FaaS users robustly compare offerings between FaaS providers as well as against non-FaaS alternatives.

## Structure

### `analysis/`

Contains code for analyzing test results. Primarily written in Python.

The main program for generating graphs is `graph.py` which can be run with `python3 graph.py $FILES $GRAPH_TYPE --other-params`. An example would be `python3 graph.py ../results/some-result.json cdf`.

Additional programs exist for analysis, such as `*.ipynb` files that have been used to explore results.

A `requirements.txt` lists the Python dependencies.

Altair also needs to be setup with Jupyter follwing the [Altair + Jupyter Quickstart](https://altair-viz.github.io/getting_started/installation.html#quick-start-altair-notebook).

Also, Python must be at least Python 3.6.

### `apps/`

Contains code for generating infrastructure and running load tests. Primarily written in TypeScript.

Dependencies are managed by Yarn in the root of this repo (not in `apps/`), and can be installed by running `yarn`.

#### Benchmarks

`benchmarks/` contains the benchmarks that are available to run, as well as `normalize-results` for parsing benchmark output into a format that `graph.py` can use.

Benchmarks should be run with `ts-node` (unless they are compiled to JavaScript beforehand) and must be provided a `--provider` argument (with `aws` being the only valid value currently). Benchmarks need to have AWS credentials available, such as through exporting `AWS_ACCESS_KEY_ID` and similar into the environment. Benchmarks will run for every VM size (128, 256, 512, 1024, 2048) by default (configurable with `--memorySizes=128,256`) and deploy the infrastructure that they need to run, execute the benchmark (which can take >5 minutes), write results to a file in `pwd`, and then teardown any infrastructure they created. If an error occurs, they will leave the infrastructure up for later debugging, but then proceed to the next memory size to test.

Results can be prepared for `graph.py` by running `ts-node benchmarks/normalize-results.ts $FILENAME`.

#### FaaS

`faas/` contains the source code that will be executed on the FaaS instances. It is a minimal, single file program with no external dependencies besides those available in the Node.js 8.15 core. It will be packaged and uploaded to FaaS deployments by the infrastructure orchestrators.

#### Infrastructure

`infrastructure/` contains the orchestrators responsible for deploying infrastructure that will be tested by the benchmarks. Each cloud provider has its own folder, with unique deployment instructions for the different infrastructure types within it. The available types are `faas-https` and `faas-pubsub` (with `faas-kvstore` in the works). Orchestrators can both deploy and teardown infrastructure under their control, though operations must occur within the lifetime of the program since state is kept in memory (however, this is not entirely true since `serverless` is used under-the-hood to manage infrastructure, and it stores state in the filesystem and on AWS through CloudFormation. The program outputs where this state is stored during execution with a line like `Working in /tmp/faas-.../`).

This component of the benchmarking framework can be run independently using the `infrastructure/demo.ts` entrypoint, which will validate arguments provided against type definitions specified by the requested infrastructure type.

#### Triggers

`triggers/` contains the runners responsible for sending requests to the various FaaS triggers, such as SQS for Pub/Sub or API Gateway for HTTPS. Each trigger type gets its own folder, with any FaaS provider-unique implementation information encapsulated within it. The available types are `https` and `pubsub`. Runners are configurable in the rate of requests then send per second and other factors (see `triggers/shared/types.ts` for more information). Additionally, runners require a target to be provided that they will direct requests to.

This component of the benchmarking framework can be run independently using the `triggers/demo.ts` entrypoint, which will validate arguments provided against type definitions specified by the requested trigger type.

### `experiments/`

Contains self-contained ad-hoc lil' experiments (for testing things like network jitter or SNTP). Primarily written in node.js. Each experiment _should_ (hopefully) have a readme or explanatory file within it.
