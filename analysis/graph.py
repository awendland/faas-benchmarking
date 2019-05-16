import altair as alt
import matplotlib.pyplot as plt
from matplotlib import cm
import numpy as np
import json, sys, os, argparse, re

from shared import *

# x_axis = ticks/round
# y_axis = average latency
def over_time(responses, out_prefix, percentiles="5,95", latency="req_rtt"):
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
        x_time.append(i)

    plt.errorbar(x_time, y_avg, yerr=y_percs, fmt='go-')
    plt.xlabel('Round', fontsize=18)
    plt.ylabel('Latency (ms)', fontsize=16)
    plt.title('Latency per Round (5, 95 percentile bars)')
    plt.xticks(range(last_round+1))
    plt.show()
    plt.savefig(out_prefix + "_latency_line_" + '.png')

# x_axis: latency
# y_axis: percent
# expects function name like: cold-start-911c-1024-node8-API
# multi is either "vm_size" or "trigger"
def cdf(data_files, out_prefix, filter="all", latency="req_rtt", multi="vm_size"):
    data_files.sort(key=lambda d: d[0]['size'])
    fig = plt.figure(figsize=(10,5))
    ax = plt.subplot(111)
    burst_color = cm.get_cmap('nipy_spectral', len(data_files))
    vm_set = set()
    for idx,responses in enumerate(data_files):
        if filter=="cold":
            resp = []
            for response in responses:
                if response['json']['runCount'] == 1:
                    resp.append(response)
            filtered_resp = resp
        elif filter=="warm":
            resp = []
            for response in responses:
                if response['json']['runCount'] > 1:
                    resp.append(response)
            filtered_resp = resp
        else:
            filtered_resp = responses

        filtered_resp = sorted(map(lambda r: (calc_latency(r, method=latency)), filtered_resp))

        num_points = len(filtered_resp)
        x, y = [0], [0]

        for i in range(0, num_points):
            x.append(filtered_resp[i])
            y.append(float(i) / num_points * 100)

        if multi=="vm_size":
            vm_mem_sz = re.search('[0-9a-f]+-(\d+)-[a-z0-9]', responses[0]['json']['functionName']).group(1)
            label = '{} MB VM (n={})'.format(vm_mem_sz, len(filtered_resp))
        elif mult=="trigger":
            trigger = re.search('-+([A-Z]+[A-Z3]*)', responses[0]['json']['functionName']).group(1)
            label = '{} trigger (n={})'.format(trigger, len(filtered_resp))
        else:
            label = 'n={}'.format(len(filtered_resp))

        ax.plot(x, y,
                '-' if idx % 2 == 0 else '--',
                label=label,
                color=burst_color(idx))

    test_type = ''
    if filter=="cold":
        test_type="Cold "
    elif filter=="warm":
        test_type="Warm "

    plt.xlabel('Latency (ms, {})'.format(latency))
    plt.ylabel('% of Requests')

    ax.legend()
    if len(data_files) > 1:
        title = test_type + 'Start Latency with Varying Request Sizes'
        plt.title(title)
        plt.savefig("-".join(out_prefix.split("-")[:-2]) + "_MULTI_CDF_" + filter + '.png')
    else:
        title = test_type + 'Start Latency with '
        plt.title(title)
        plt.savefig(out_prefix + "_CDF_" + filter + ".png")
    #return zip(x, y)

# x_axis: ticks
# y_axis: # of VMs
def cold_per_burst(data_file, out_prefix, x_axis="Burst Size"):
    #memory = [128,256,512,1024,2048]
    added_burst = [50 for i in range(14*2)]
    fig = plt.figure(figsize=(10,5))
    ax = plt.subplot(111)

    data_file = sorted(data_file, key=lambda r: r['tick'], reverse=True)
    ticks = []
    warm_count = []
    new_vm_count = []
    all_vm_count = []
    reqs = []

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
            vm_set.add(cur_req['json']['id'])
            if cur_req['json']['runCount'] == 1:
                if cur_req['json']['triggeredTime'] - cur_req['json']['initTime'] > calc_latency(cur_req):
                    pre_warms += 1
                    print((cur_req['json']['triggeredTime'] - cur_req['json']['initTime'], calc_latency(cur_req)))
                else:
                    true_cold += 1

        reqs.append(counter)
        warm_count.append(pre_warms)
        new_vm_count.append(pre_warms + true_cold)
        all_vm_count.append(len(vm_set))
        ticks.append(cur_tick)
        cur_tick += 1

    print(reqs)

    ax.plot(ticks, new_vm_count, '^-', label='new VMs this round')
    ax.plot(ticks, warm_count, 'o-', label='pre-warmed VMs (cold latency < VM lifetime)')
    ax.plot(ticks, all_vm_count, 'v-', label='total VMs seen this round')
    ax.plot(ticks, reqs, 's-', label='total requests sent')

    plt.xlabel('Time', fontsize=16)
    plt.ylabel('# of Requests', fontsize=16)
    plt.title('New requests per burst')
    ax.legend()
    plt.show()
    plt.savefig(out_prefix + "_CPB" + '.png')


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
        over_time(data_files[0], out_prefix, **extra_args)
    if args.graph_type == "cpb":
        cold_per_burst(data_files[0], out_prefix, **extra_args)