from subprocess import Popen, PIPE, STDOUT
from pathlib import Path
from datetime import datetime, timedelta
from time import sleep
import json

def run_id():
    """
    Get an ID for a test run. Currently, this counts the minutes since April 12 and
    returns them as hex.
    """
    delta = datetime.now() - datetime(2019, 4, 12, 0, 0, 0)
    return "%x" % int(delta / timedelta(minutes=1))

def run_cmd(cmd):
    """
    Runs a command and yields line as they are written to stdout or stderr (doesn't
    distinguish between the two). Will yield a tuple with either (str, None) or
    (None, int) if the process has exited (w/ int being the return code).
    """
    p = Popen(cmd, stdout=PIPE, stderr=STDOUT, encoding='utf-8')
    while p.poll() is None:
        line = p.stdout.readline()
        if line:
            yield (line.rstrip(), None)
    yield (None, p.returncode)

def run_cmd_or_throw(cmd, buffer=False, print_to_stdout=False):
    """
    Runs a command and throws an error if it doesn't return a non-zero exit code.
    Can be set to pass all stdout/stderr from the subprocess to this process's stdout,
    and/or to buffer all output lines and return them at the end.
    """
    buf = []
    for (line, ret) in run_cmd(cmd):
        if line:
            if print_to_stdout:
                print(line)
            if buffer:
                buf.append(line)
        elif ret is not None and ret != 0:
            raise Exception('cmd "{}" failed w/ ret={}'.format(' '.join(cmd)[:128], ret))
    return buf if buffer else None

def setup_infra(proj_name=None, num_fns=None, runtime=None, mem_size=None, debug=False, iam='test-faas'):
    """
    Setup infrastructure for this cold start test and return a list
    of the resulting FaaS URLs.
    """
    if not proj_name or not num_fns or not runtime or not mem_size:
        raise Exception('missing param')
    infra_script = Path(__file__).parent.joinpath('..', 'old-apps', 'infra_setup_runner.js')
    cmd = ['node', str(infra_script),
           '--loglevel', 'debug' if debug else 'verbose',
           '--project-name', proj_name,
           '--numfns', str(num_fns),
           '--runtime', str(runtime),
           '--memsize', str(mem_size),
           '--faas-iam', iam]
    output = run_cmd_or_throw(cmd, buffer=True, print_to_stdout=True)
    urls = list(filter(lambda l: 'execute-api' in l, output))
    urls = [u.replace('info: ', '') for u in urls]
    sleep(10) # Allow lambdas to get propagated
    return urls

def send_requests(filename=None, rpws=None, window=None, duration=None, urls=None):
    """
    Trigger HTTP requests against the FaaS endpoints and write the results to a
    file.
    """
    if not filename or not rpws or not window or not duration or not urls:
        raise Exception('missing param')
    engine_script = Path(__file__).parent.joinpath('..', 'old-apps', 'engine_runner.js')
    cmd = ['node', str(engine_script),
           '--window-size', str(window),
           '--rpw', ','.join(map(str, rpws)),
           '--duration', str(duration),
           '--out', filename,
           '--urls', ','.join(urls)]
    run_cmd_or_throw(cmd, print_to_stdout=True)

def fetch_checkpoint_or_run(name, init_fn):
    """
    Load data from a checkpoint file, or regenerate the data if the checkpoint file doesn't
    exist (and save it in the checkpoint file for the next caller)
    """
    checkpoint = Path('{}.checkpoint'.format(name))
    if checkpoint.is_file():
        return json.loads(checkpoint.read_text())
    else:
        data = init_fn()
        checkpoint.write_text(json.dumps(data))
        return data
