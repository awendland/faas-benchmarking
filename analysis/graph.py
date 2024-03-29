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
            try:
                y_tmp.setdefault(response['tick'], []).append(calc_latency(response))
            except ValueError:
                pass

        to_graph[params['triggerType']][params['memorySize']]['y_tmp'] = y_tmp
        to_graph[params['triggerType']][params['memorySize']]['incrementPeriod'] = params['incrementPeriod']
        to_graph.setdefault(params['triggerType'], {}).setdefault(params['memorySize'],{}).setdefault('n', 0)
        to_graph[params['triggerType']][params['memorySize']]['n'] += 1

    for t, trigger in enumerate(sorted(to_graph.keys())):
        for m, mem_sz in enumerate(sorted(to_graph[trigger])):
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
    ax = plt.subplot(111)
    handles,labels = ax.get_legend_handles_labels()
    handles = [handles[1], handles[3], handles[4], handles[0], handles[2]]
    labels = [labels[1], labels[3], labels[4], labels[0], labels[2]]
    ax.legend(handles,labels,loc='best', bbox_to_anchor=(0.5, 0., 0.5, 0.5))
    plt.ylim(bottom=0)
    plt.savefig(out_prefix + "_latency_line" + '.png')

# x_axis: latency
# y_axis: percent
# expects function name like: cold-start-911c-1024-node8-API
# multi is either "vm_size" or "trigger"
def cdf(data_files, out_prefix, filter="all", multi="memorySize"):
    data_files.sort(key=lambda d: d['params']['memorySize'])
    fig = plt.figure(figsize=(8,5))
    ax = plt.subplot(111)
    vm_set = set()
    min_x = float("inf")
    max_x = -float("inf")
    max_runcount = 0

    to_graph = {}

    for responses in data_files:
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
        else:
            filtered_resp = responses

        to_graph[params[multi]] = to_graph.setdefault(params[multi], []) + filtered_resp

    # all_x = []
    for idx, m in enumerate(sorted(to_graph.keys())):
        filtered_resp = []
        for i in to_graph[m]:
            try:
                filtered_resp.append(calc_latency(i))
            except ValueError:
                pass
        filtered_resp = sorted(filtered_resp)
        #filtered_resp = sorted(map(lambda r: (calc_latency(r)), to_graph[m]))

        num_points = len(filtered_resp)
        x, y = [0,0], [0,0]

        for i in range(num_points):
            x.append(filtered_resp[i])
            max_x = max(max_x, filtered_resp[i])
            min_x = min(min_x, filtered_resp[i])
            y.append((i+1) / num_points * 100)
        x[1] = min_x
        #all_x.extend(x)

        if filter == "warm":
            label = '{} MB VM (n={})'.format(m, int(len(data_files) / 5))
        elif multi =="memorySize":
            label = '{} MB VM (n={})'.format(m, len(filtered_resp))
        else:
            label = '{} trigger (n={})'.format(m, len(filtered_resp))

        ax.plot(x, y,
                '-',
                label=label,
                color='C'+str(idx))

    # all_x = sorted(all_x)
    # print (np.median(all_x), all_x[5], all_x[-1], np.std(all_x), all_x[int(len(all_x) * .9)])
    # import sys
    # sys.exit()

    test_type = ''
    if filter=="cold":
        test_type="Cold "
    elif filter=="warm":
        test_type="Warm "

    plt.xlabel('Latency (ms)')
    plt.ylabel('% of Requests')

    plt.grid(True)
    # tunable to change axes
    plt.xticks(np.arange(0, 100*(max_x//100+2), step=100), rotation='vertical')
    plt.yticks(np.arange(0, 120, step=20))
    plt.subplots_adjust(bottom=0.15)

    handles,labels = ax.get_legend_handles_labels()
    handles = [handles[1], handles[3], handles[4], handles[0], handles[2]]
    labels = [labels[1], labels[3], labels[4], labels[0], labels[2]]
    ax.legend(handles,labels,loc='lower right')
    if multi == "memorySize":
        if len(data_files) > 1:
            title = data_files[0]['params']['triggerType'] + ' ' + test_type + 'Start Latency with Varying VM Memory Sizes'
            plt.title(title)
            plt.savefig(out_prefix + "_mSZ_CDF_" + filter + '.png')
        else:
            title = data_files[0]['params']['triggerType'] + ' ' + test_type + 'Start Latency'
            plt.title(title)
            plt.savefig(out_prefix + "_SZ_CDF_" + filter + ".png")
    elif multi == 'triggerType':
        if len(data_files) > 1:
            title = test_type + 'Start Latency with Varying Triggers'
            plt.title(title)
            plt.savefig(out_prefix + "_mTRIG_CDF_" + filter + '.png')
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

    to_graph = {}
    neg_rtts = 0
    for data_file in data_files:
        data_file = add_ticks(data_file)
        params = data_file['params']
        responses = data_file['responses']

        responses = sorted(responses, key=lambda r: r['tick'], reverse=True)
        ticks = []
        new_vm_count = []
        all_vm_count = []
        expct = []
        reqs = []

        cur_tick = 0
        to_graph[params['triggerType']][params['memorySize']]['n'] = to_graph.setdefault(params['triggerType'], {}).setdefault(params['memorySize'],{}).setdefault('n', 0) + 1

        while responses:
            counter = 0
            pre_warms = 0
            true_cold = 0
            clock = 0
            vm_set = set()
            run_times = []

            while responses and cur_tick == responses[-1]['tick']:
                cur_req = responses.pop()
                counter += 1
                vm_set.add(cur_req['id'])
                if cur_req['runCount'] == 1:
                    try:
                        if cur_req['triggeredTime'] - cur_req['initTime'] > calc_latency(cur_req):
                            pre_warms += 1
                            print("PREWARM {} {}".format(cur_req['triggeredTime'] - cur_req['initTime'], calc_latency(cur_req)))
                        else:
                            true_cold += 1
                    except ValueError as e:
                        neg_rtts += 1
                        pass
            to_graph.setdefault(params['triggerType'], {}).setdefault(params['memorySize'],{}).setdefault('incrementSize', params['incrementSize'])
            to_graph.setdefault(params['triggerType'], {}).setdefault(params['memorySize'],{}).setdefault('incrementPeriod', params['incrementPeriod'])

            to_graph.setdefault(params['triggerType'], {}).setdefault(params['memorySize'],{}).setdefault('reqs', {}).setdefault(cur_tick, []).append(counter)
            to_graph.setdefault(params['triggerType'], {}).setdefault(params['memorySize'],{}).setdefault('new_vm_count', {}).setdefault(cur_tick, []).append(pre_warms + true_cold)
            to_graph.setdefault(params['triggerType'], {}).setdefault(params['memorySize'],{}).setdefault('all_vm_count', {}).setdefault(cur_tick, []).append(len(vm_set))
            # print(to_graph[params['triggerType']][params['memorySize']]['all_vm_count'])
            cur_tick += 1

    print (neg_rtts)
    reqs_graphed = False
    for t, trigger in enumerate(sorted(to_graph.keys())):
        for m, mem_sz in enumerate(sorted(to_graph[trigger])):
            max_tick = 0
            reqs, reqs_err = [], []
            new_vm, new_vm_err = [], []
            all_vm, all_vm_err = [], []
            for tick in sorted(to_graph[trigger][mem_sz]['reqs'].keys()):
                reqs.append(np.average(to_graph[trigger][mem_sz]['reqs'][tick]))
                max_tick = max(max_tick, tick*to_graph[trigger][mem_sz]['incrementPeriod']/1000)
            for tick in sorted(to_graph[trigger][mem_sz]['new_vm_count'].keys()):
                new_vm.append(np.average(to_graph[trigger][mem_sz]['new_vm_count'][tick]))
                new_vm_err.append(np.std(to_graph[trigger][mem_sz]['new_vm_count'][tick]))
                # print(to_graph[trigger][mem_sz]['new_vm_count'][tick])
            for tick in sorted(to_graph[trigger][mem_sz]['all_vm_count'].keys()):
                all_vm.append(np.average(to_graph[trigger][mem_sz]['all_vm_count'][tick]))
                all_vm_err.append(np.std(to_graph[trigger][mem_sz]['all_vm_count'][tick]))

            max_tick += 1
            # ax.plot(ticks, new_vm_count, '^-', label='new VMs this round', color='C' + str(idx))
            # ax.plot(ticks, warm_count, 'o-', label='pre-warmed VMs (cold latency < VM lifetime)', color='C' + str(idx))
            ax.errorbar(np.arange(0, (max_tick+1), to_graph[trigger][mem_sz]['incrementPeriod']/1000),
                all_vm,
                yerr=all_vm_err,
                fmt='v-',
                label='total ' + trigger + ' ' +
                    mem_sz + ' MB VMs seen (next ' + str(to_graph[trigger][mem_sz]['incrementPeriod']/1000) +
                    ' seconds) (n = {})'.format(to_graph[trigger][mem_sz]['n']), color='C' + str(t+m))
            ax.plot(np.arange(0, (max_tick+1), to_graph[trigger][mem_sz]['incrementPeriod']/1000),
                reqs,
                'h--',
                color='pink')
            # ax.plot(ticks, expct, 's-', label='expected ' + params['triggerType'] + ' VMs sent', color='C' + str(idx))



    # expct.append(sum(run_times)/max(1, len(run_times))/1000 * (params['initRate']+params['incrementSize']*cur_tick))

    # y_tmp = to_graph.setdefault(params['triggerType'], {}).setdefault(params['memorySize'],{}).setdefault('y_tmp', {})



    # ax.plot(ticks, reqs, 'h--', label='total requests sent (next ' + str(params['incrementPeriod']/1000) + ' seconds)', color='pink')

    plt.xlabel('Time', fontsize=16)
    plt.ylabel('Count', fontsize=16)

    plt.grid(True)

    # plt.title('VM Count vs Scaling ' + params['triggerType'] + ' Requests')
    plt.title('VM Count Over Time')
    handles,labels = ax.get_legend_handles_labels()
    handles = [handles[1], handles[3], handles[4], handles[0], handles[2]]
    labels = [labels[1], labels[3], labels[4], labels[0], labels[2]]
    ax.legend(handles,labels,loc='lower right', bbox_to_anchor=(1,0))
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

    if 'name' in extra_args:
        out_prefix = extra_args['name']
        print(out_prefix)
        del extra_args['name']

    if args.graph_type == "cdf":
        cdf(data_files, out_prefix, **extra_args)
    if args.graph_type == "line":
        latency_rate(data_files, out_prefix, **extra_args)
    if args.graph_type == "cpb":
        cold_per_burst(data_files, out_prefix, **extra_args)