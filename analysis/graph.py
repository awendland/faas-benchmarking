import altair as alt
import matplotlib.pyplot as plt
from matplotlib import cm
import numpy as np
import json, sys, os, argparse, re

from shared import *

# x_axis = ticks/round
# y_axis = average latency
def latency_rate(data_files, out_prefix, percentiles="5,95"):
    data_files.sort(key=lambda d: d['params']['memorySize'])
    fig = plt.figure(figsize=(10,5))

    to_graph = {}

    for idx,data_file in enumerate(data_files):
        data_file = add_ticks(data_file)
        responses = data_file['responses']
        params = data_file['params']

        y_tmp = to_graph.setdefault(params['triggerType'], {}).setdefault(params['memorySize'],{}).setdefault('y_tmp', {})
        for response in responses:
            y_tmp.setdefault(response['tick'], []).append(calc_latency(response))

        to_graph[params['triggerType']][params['memorySize']]['y_tmp'] = y_tmp
        to_graph[params['triggerType']][params['memorySize']]['incrementPeriod'] = params['incrementPeriod']
        to_graph.setdefault(params['triggerType'], {}).setdefault(params['memorySize'],{}).setdefault('n', 0)
        to_graph[params['triggerType']][params['memorySize']]['n'] += 1

    for t, trigger in enumerate(to_graph.keys()):
        for m, mem_sz in enumerate(to_graph[trigger]):
            y_percs, y_avg, x_time = [[],[]], [], []
            percs = [int(s) for s in percentiles.split(",")]
            for tick in sorted(to_graph[trigger][mem_sz]['y_tmp'].keys()):
                avg = np.average(to_graph[trigger][mem_sz]['y_tmp'][tick])
                y_percs[0].append(avg - np.percentile(to_graph[trigger][mem_sz]['y_tmp'][tick], percs[0]))
                y_percs[1].append(np.percentile(to_graph[trigger][mem_sz]['y_tmp'][tick], percs[1]) - avg)
                y_avg.append(avg)
                x_time.append(tick*to_graph[trigger][mem_sz]['incrementPeriod']/1000)


            label = '{} trigger {} MB VM (n = {})'.format(trigger, mem_sz, to_graph[trigger][mem_sz]['n'])

            plt.errorbar(x_time, y_avg, yerr=y_percs, fmt='o-', color="C"+str(t+m), label=label, capsize=5)

    plt.xlabel('Time (s)', fontsize=18)
    plt.ylabel('Latency (ms)', fontsize=16)

    plt.grid(True)

    plt.title(params['triggerType'] + ' Latency Over Time (5, 95 percentile bars)')
    # plt.xticks()
    plt.show()
    plt.legend(loc='best', bbox_to_anchor=(0.5, 0., 0.5, 0.5))
    plt.ylim(bottom=0)
    plt.savefig(out_prefix + "_latency_line" + '.png')

# x_axis: latency
# y_axis: percent
# expects function name like: cold-start-911c-1024-node8-API
# multi is either "vm_size" or "trigger"
def cdf(data_files, out_prefix, filter="all", latency="req_rtt", multi="vm_size"):
    data_files.sort(key=lambda d: d['params']['memorySize'])
    fig = plt.figure(figsize=(12,5))
    ax = plt.subplot(111)
    vm_set = set()
    min_x = float("inf")
    max_x = -float("inf")
    max_runcount = 0
    for idx,responses in enumerate(data_files):
        params = responses['params']
        responses = responses['responses']
        if filter=="cold":
            resp = []
            for response in responses:
                if response['runCount'] == 1:
                    resp.append(response)
            filtered_resp = resp
        elif filter=="warm":
            resp = []
            for response in responses:
                max_runcount = max(max_runcount, response['runCount'])
                if response['runCount'] > 1:
                    resp.append(response)
            filtered_resp = resp
            print(max_runcount)
        else:
            filtered_resp = responses

        filtered_resp = sorted(map(lambda r: (calc_latency(r, method=latency)), filtered_resp))

        num_points = len(filtered_resp)
        x, y = [0,0], [0,0]

        for i in range(num_points):
            x.append(filtered_resp[i])
            max_x = max(max_x, filtered_resp[i])
            min_x = min(min_x, filtered_resp[i])
            y.append((i+1) / num_points * 100)
        x[1] = min_x

        if multi == "vm_size":
            label = '{} MB VM (n={})'.format(params['memorySize'], len(filtered_resp))
        elif multi == "trigger":
            label = '{} trigger (n={})'.format(params['triggerType'], len(filtered_resp))
        else:
            label = 'n={}'.format(len(filtered_resp))

        ax.plot(x, y,
                '-',
                label=label,
                color='C'+str(idx))
    test_type = ''
    if filter=="cold":
        test_type="Cold "
    elif filter=="warm":
        test_type="Warm "

    plt.xlabel('Latency (ms, {})'.format(latency))
    plt.ylabel('% of Requests')

    plt.grid(True)
    plt.xticks(np.arange(0, 10000*(max_x//10000+2), step=10000))
    plt.yticks(np.arange(0, 120, step=20))

    ax.legend(loc='lower right', bbox_to_anchor=(1.5,0))
    if multi == "vm_size":
        if len(data_files) > 1:
            title = test_type + 'Start Latency with Varying Request Sizes'
            plt.title(title)
            plt.savefig("-".join(out_prefix.split("-")[:-2]) + "_mSZ_CDF_" + filter + '.png')
        else:
            title = test_type + 'Start Latency'
            plt.title(title)
            plt.savefig(out_prefix + "_SZ_CDF_" + filter + ".png")
    elif multi == 'trigger':
        if len(data_files) > 1:
            title = test_type + 'Start Latency with Varying Triggers'
            plt.title(title)
            plt.savefig("-".join(out_prefix.split("-")[:-2]) + "_mTRIG_CDF_" + filter + '.png')
        else:
            title = data_files[0]['params']['triggerType'].capitalize() + " " + test_type + 'Start Latency'
            plt.title(title)
            plt.savefig(out_prefix + "_TRIG_CDF_" + filter + ".png")
    else:
        title = test_type + 'Start Latency'
        plt.title(title)
        plt.savefig(out_prefix + "_CDF_" + filter + ".png")


# x_axis: requests per second
# y_axis: # of VMs
def cold_per_burst(data_files, out_prefix, interval=5):
    data_files.sort(key=lambda d: d['params']['triggerType'])
    fig = plt.figure(figsize=(10,5))
    ax = plt.subplot(111)

    reqs = []

    for idx,data_file in enumerate(data_files):
        data_file = add_ticks(data_file)
        file_params = data_file['params']
        data_file = data_file['responses']

        data_file = sorted(data_file, key=lambda r: r['tick'], reverse=True)
        ticks = []
        warm_count = []
        new_vm_count = []
        all_vm_count = []
        expct = []
        reqs = []

        cur_tick = 0

        while data_file:
            counter = 0
            pre_warms = 0
            true_cold = 0
            clock = 0
            vm_set = set()
            run_times = []

            while data_file and cur_tick == data_file[-1]['tick']:
                cur_req = data_file.pop()
                counter += 1
                vm_set.add(cur_req['id'])
                run_times.append(cur_req['processingTime'])
                if cur_req['runCount'] == 1:
                    if cur_req['triggeredTime'] - cur_req['initTime'] > calc_latency(cur_req):
                        pre_warms += 1
                    else:
                        true_cold += 1

            # print(sum(run_times)/max(1,len(run_times))/1000)
            # expct.append(sum(run_times)/max(1, len(run_times))/1000 * (file_params['initRate']+file_params['incrementSize']*cur_tick))
            reqs.append(counter)
            warm_count.append(pre_warms)
            new_vm_count.append(pre_warms + true_cold)
            all_vm_count.append(len(vm_set))
            ticks.append(cur_tick*file_params['incrementPeriod']/1000)
            cur_tick += 1

        # ax.plot(ticks, new_vm_count, '^-', label='new VMs this round', color='C' + str(idx))
        # ax.plot(ticks, warm_count, 'o-', label='pre-warmed VMs (cold latency < VM lifetime)', color='C' + str(idx))
        ax.plot(ticks, all_vm_count, 'v-', label='total ' + file_params['triggerType'] + ' ' + str(file_params['memorySize']) + ' MB VMs seen (next ' + str(file_params['incrementPeriod']/1000) + ' seconds)', color='C' + str(idx))
        # ax.plot(ticks, expct, 's-', label='expected ' + file_params['triggerType'] + ' VMs sent', color='C' + str(idx))
    ax.plot(ticks, reqs, 'h--', label='total requests sent (next ' + str(file_params['incrementPeriod']/1000) + ' seconds)', color='pink')

    plt.xlabel('Time', fontsize=16)
    plt.ylabel('Count', fontsize=16)

    plt.grid(True)

    # plt.title('VM Count vs Scaling ' + params['triggerType'] + ' Requests')
    plt.title('VM Count Over Time')
    ax.legend(loc='lower right', bbox_to_anchor=(1,0))
    plt.show()

    plt.ylim(bottom=0)
    if len(data_files) > 1:
        plt.savefig(out_prefix + "_mCPB" + '.png')
    else:
        plt.savefig(out_prefix + "_CPB" + '.png')


def add_ticks(result):
    responses = result['responses']
    params = result['params']
    increment = params['incrementPeriod']
    if not increment:
        print("error no increment period")
    responses = sorted(responses, key=lambda r : r['startTime'])
    first_time = responses[0]['startTime']

    responses = sorted(responses, key=lambda r : r['endTime'])
    # first_end_time = responses[0]['endTime']
    for i, r in enumerate(responses):
        responses[i]['tick'] = (r['startTime'] - first_time)//(increment)
    result['responses'] = responses
    return result

if __name__== "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("data_file", help="file(s) containing response data to load; separate multiple files with only a comma")
    parser.add_argument("graph_type", help="which type of graph to generate",
                        choices=["cdf", "line", "cpb"])
    args, extra_args_raw = parser.parse_known_args()

    data_files = load_data_files(args.data_file.split(","))

    extra_args = {s.split("=")[0].replace("--", ""): s.split("=")[1] for s in extra_args_raw}

    out_prefix = os.path.splitext(os.path.basename(args.data_file))[0]
    out_prefix = "pubsub-warm-constant-all"

    if args.graph_type == "cdf":
        cdf(data_files, out_prefix, **extra_args)
    if args.graph_type == "line":
        latency_rate(data_files, out_prefix, **extra_args)
    if args.graph_type == "cpb":
        cold_per_burst(data_files, out_prefix, **extra_args)