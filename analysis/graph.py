import altair as alt
import matplotlib.pyplot as plt
from matplotlib import cm
import numpy as np
import json, sys, os, argparse, re

from shared import *

# x_axis = ticks/round
# y_axis = average latency
def latency_rate(data_file, out_prefix, percentiles="5,95", latency="req_rtt"):
    data_file = add_ticks(data_file)
    responses = data_file['responses']
    params = data_file['params']

    y_tmp = {}
    last_round = 0
    for response in responses:
        last_round = max(last_round, response['tick'])
        y_tmp.setdefault(response['tick'], []).append(calc_latency(response, method=latency))
    percs = [int(s) for s in percentiles.split(",")]
    y_percs, y_avg, x_time = [[],[]], [], []
    for i in range(last_round+1):
        avg = np.average(y_tmp[i])
        if(avg < 0):
            print(avg)
        y_percs[0].append(avg - np.percentile(y_tmp[i], percs[0]))
        y_percs[1].append(np.percentile(y_tmp[i], percs[1]) - avg)
        y_avg.append(avg)
        x_time.append(params['incrementPeriod'] + i*params['incrementSize'])

    plt.errorbar(x_time, y_avg, yerr=y_percs, fmt='go-')
    plt.xlabel('Requests per Second', fontsize=18)
    plt.ylabel('Latency (ms)', fontsize=16)

    plt.grid(True)

    plt.title(params['triggerType'] + ' Latency at Scale (5, 95 percentile bars)')
    plt.xticks(range(last_round+1))
    plt.show()
    plt.savefig(out_prefix + "_latency_line_" + '.png')

# x_axis: latency
# y_axis: percent
# expects function name like: cold-start-911c-1024-node8-API
# multi is either "vm_size" or "trigger"
def cdf(data_files, out_prefix, filter="all", latency="req_rtt", multi="vm_size"):
    data_files.sort(key=lambda d: d['params']['memorySize'])
    fig = plt.figure(figsize=(12,5))
    ax = plt.subplot(111)
    # burst_color = cm.get_cmap('nipy_spectral', len(data_files))
    vm_set = set()
    min_x = 0
    max_x = 0
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
                if response['runCount'] > 1:
                    resp.append(response)
            filtered_resp = resp
        else:
            filtered_resp = responses

        filtered_resp = sorted(map(lambda r: (calc_latency(r, method=latency)), filtered_resp))

        num_points = len(filtered_resp)
        x, y = [0], [0]

        for i in range(num_points):
            x.append(filtered_resp[i])
            max_x = max(max_x, filtered_resp[i])
            min_x = min(min_x, filtered_resp[i])
            y.append(float(i) / (num_points-1) * 100)

        if multi == "vm_size":
            label = '{} MB VM (n={})'.format(params['memorySize'], len(filtered_resp))
        elif multi == "trigger":
            label = '{} trigger (n={})'.format(params['triggerType'], len(filtered_resp))
        else:
            label = 'n={}'.format(len(filtered_resp))

        ax.plot(x, y,
                '-',
                label=label,
                # color=burst_color(idx))
                color='C'+str(idx))

    test_type = ''
    if filter=="cold":
        test_type="Cold "
    elif filter=="warm":
        test_type="Warm "

    plt.xlabel('Latency (ms, {})'.format(latency))
    plt.ylabel('% of Requests')

    plt.grid(True)
    plt.xticks(np.arange(0, 500*(max_x//500+1), step=500))
    plt.yticks(np.arange(0, 120, step=20))

    ax.legend(loc='best', bbox_to_anchor=(0.5, 0., 0.5, 0.5))
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
    burst_color = cm.get_cmap('nipy_spectral', len(data_files))

    for data_file in data_files:
        data_file = add_ticks(data_file)
        file_params = data_file['params']
        data_file = data_file['responses']

        data_file = sorted(data_file, key=lambda r: r['tick'], reverse=True)
        ticks = []
        warm_count = []
        new_vm_count = []
        all_vm_count = []
        expct = []
        run_times = []

        cur_tick = 0

        while data_file:
            counter = 0
            pre_warms = 0
            true_cold = 0
            clock = 0
            vm_set = set()

            while data_file and cur_tick == data_file[-1]['tick']:
                cur_req = data_file.pop()
                counter += 1
                vm_set.add(cur_req['id'])
                run_times.add(cur_req['processingTime'])
                if cur_req['runCount'] == 1:
                    if cur_req['triggeredTime'] - cur_req['initTime'] > calc_latency(cur_req):
                        pre_warms += 1
                        print((cur_req['triggeredTime'] - cur_req['initTime'], calc_latency(cur_req)))
                    else:
                        true_cold += 1


            expct.append(sum(run_times)/len(run_times) * file_params['incrementPeriod']*cur_tick)
            warm_count.append(pre_warms)
            new_vm_count.append(pre_warms + true_cold)
            all_vm_count.append(len(vm_set))
            ticks.append(cur_tick)
            cur_tick += 1

        # ax.plot(ticks, new_vm_count, '^-', label='new VMs this round', color=burst_color(idx))
        # ax.plot(ticks, warm_count, 'o-', label='pre-warmed VMs (cold latency < VM lifetime)', color=burst_color(idx))
        ax.plot(ticks, all_vm_count, 'v-', label='total ' + file_params['triggerType'] + ' VMs seen this round', color=burst_color(idx))
        ax.plot(ticks, expct, 's-', label='expected ' + file_params['triggerType'] + ' VMs sent', color=burst_color(idx))

    plt.xlabel('Time', fontsize=16)
    plt.ylabel('# of Requests', fontsize=16)

    plt.grid(True)

    plt.title('VM Count vs Scaling ' + params['triggerType'] + ' Requests')
    ax.legend()
    plt.show()
    if len(data_files > 1):
        plt.savefig(out_prefix + "_mCPB" + '.png')
    else:
        plt.savefig(out_prefix + "_CPB" + '.png')


def add_ticks(result):
    responses = result['responses']
    params = result['params']
    increment = params['incrementPeriod']
    if increment:
        return result
    responses = sorted(responses, lambda r : r['endTime'])
    first_time = responses[0]['endTime']
    for i, r in enumerate(responses):
        responses[i]['tick'] = (r['endTime'] - first_time)//(increment * 1000)
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

    if args.graph_type == "cdf":
        cdf(data_files, out_prefix, **extra_args)
    if args.graph_type == "line":
        latency_rate(data_files[0], out_prefix, **extra_args)
    if args.graph_type == "cpb":
        cold_per_burst(data_files[0], out_prefix, **extra_args)