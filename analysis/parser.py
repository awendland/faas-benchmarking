import altair as alt
import matplotlib.pyplot as plt
from matplotlib import cm
import numpy as np
import pandas as pd
import json, sys, os, argparse, re

from shared import *

# x_axis: "tick"
# y_axis: "latency", "heat"
def over_time(responses, out_prefix, percentiles="5,95", y_axis="latency", latency="upload_rtt_adj"):
    window = responses[0]['window']

    if y_axis == "latency":
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
            x_time.append((i+1)*window)

        plt.errorbar(x_time, y_avg, yerr=y_percs, fmt='go-')
        plt.xlabel('Time (ms)', fontsize=18)
        plt.ylabel('Latency (ms)', fontsize=16)

        plt.show()
        plt.savefig(out_prefix + "_latency_line_" + latency + '.png')

    if y_axis == "cold_v_warm":
        y_new = [0 for i in range(last_round+1)]
        y_old = [0 for i in range(last_round+1)]
        y_total = [0 for i in range(last_round+1)]
        last_round = 0
        
        old_ids = set()
        
        for response in responses:
            last_round = max(last_round, response['tick'])
            old_ids.add(response['json']['id'])
            y_total[response['tick']] += 1
            if response["runCount"] > 1:
                y_old[response['tick']] += 1
            else:
                y_new[response['tick']] += 1

        x_time = [0 for i in range(last_round+1)]
        for i in range(last_round+1):
            x_time[i] = (i+1)*window

        plt.plot(x_time, y_total, 'k.-', x_time, y_new, 'co-', x_time, y_old, 'g^-')
        plt.xlabel('Time (ms)', fontsize=18)
        plt.ylabel('# of VMs', fontsize=16)

        plt.show()
        plt.savefig(out_prefix + "_heat_" + latency + '.png')
        
        if len(old_ids) != len(y_new):
            print("Unique id's %d VS cold start %d" % (len(old_ids), len(y_new)))

# x_axis: latency
# y_axis: percent
def cdf(data_files, out_prefix, filter="all", latency="req_rtt", test_type="Cold"):
    data_files.sort(key=lambda d: d[0]['size'])
    fig = plt.figure(figsize=(10,5))
    ax = plt.subplot(111)
    memory = re.search('[0-9a-f]+-(\d+)-[a-z]+[a-z0-9]*-\d+$', data_files[0][0]['json']['functionName']).group(1)
    burst_color = cm.get_cmap('nipy_spectral', len(data_files))
    vm_set = set()
    filtered_set = set()
    df = pd.DataFrame()
    for idx,responses in enumerate(data_files):
        for r in responses:
            vm_set.add(r['json']['id'])
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
            print("warm responses: " + str(len(filtered_resp)))
            for r in filtered_resp:
                filtered_set.add(r['json']['id'])
        else:
            filtered_resp = responses

        filtered_resp = sorted(map(lambda r: (calc_latency(r, method=latency)), responses))

        num_points = len(filtered_resp)
        x, y = [0], [0]

        for i in range(0, num_points):
            x.append(filtered_resp[i])
            y.append(float(i) / num_points * 100)
            
        df['Latency (ms, {})'.format(latency)], df['% of Requests'] = x, y

        ax.plot(x, y,
                '-' if idx % 2 == 0 else '--',
                label='{} reqs (n={})'.format(responses[0]['size'], len(responses)),
                color=burst_color(idx))

    title = test_type + ' Start Latency with Varying Request Sizes ({}MB)'.format(memory)
    chart = alt.Chart(df).mark_line().encode(
        x='Latency (ms, {})'.format(latency),
        y='% of Requests',
    ).configure(
        background='white'
    ).properties(
        title=title
    )
    chart.save('chart.png')
    
    plt.xlabel('Latency (ms, {})'.format(latency))
    plt.ylabel('% of Requests')
    
    plt.title(title)
    ax.legend()
    plt.show()
    plt.savefig(out_prefix + "_CDF_" + filter + '.png')

    #return zip(x, y)
    
# x_axis: latency
# y_axis: percent
def spawn_cdf(responses, out_prefix):
    filtered_resp = []
    for response in responses:
        if response['json']['runCount'] == 1:
            filtered_resp.append(response)

    sorted_spawn = sorted(filtered_resp, key=lambda response: response['json']['initTime'])
    x_req = sorted(map(lambda r: r['timings']['upload'], filtered_resp))
    num_points = len(filtered_resp)
    x_spawn = []
    y = []
    
    for i in range(0, num_points):
        x_spawn.append(sorted_spawn[i]['json']['initTime'])
        y.append(float(i) / num_points * 100)
    plt.plot(x_spawn, y, '-', x_req, y, '--')
    plt.xlabel('Time')
    plt.ylabel('% of VMs (n={})'.format(num_points), fontsize=16)
    plt.show()
    plt.savefig(out_prefix + "_spawn_request_CDF_" + '.png')

    return zip(x_req, x_spawn)

def cdf_helper(responses, max_latency, points):
    total = len(responses)
    responses = sorted(responses, key=lambda response: calc_latency(response, method=latency))
    x = [i*max_latency/(points-1) for i in range(points)]
    y = []
    cur = 0
    for latency in x:
        while responses and calc_latency(responses[0], method=latency) <= latency:
            cur += 1
            responses.pop()
        y.append(cur/total)
    return y


# y_axis: latency
# x_axis: round
# z_axis: percent
# yeah this part is gonna be weird
def cdf_3d(responses, out_prefix):
    max_latency = 0
    last_round = 0
    rounds = {}
    for response in responses:
        rounds.setdefault(response['round'], []).append(response)
        max_latency = max(max_latency, calc_latency(response, method=latency))
        last_round = max(last_round, response['round'])

    x = np.linspace(0, last_round, last_round+1)
    y = np.linspace(0, max_latency, 101)

    xx, yy = np.meshgrid(x, y)


    z = []
    for i in range(last_round+1):
        z.append(cdf_helper(rounds[i], max_latency, 101))
    np.transpose(z)
    fig = plt.figure()
    ax = fig.gca(projection='3d')
    surf = ax.plot_surface(xx, yy, z, cmap=cm.coolwarm,
                       linewidth=0, antialiased=False)
    fig.savefig(out_prefix + "_cdf_over_time" + '.jpg')
    
def l_cnt(data_files, out_prefix, filter="all"):
    memory = [128,256,512,1024,2048]
    burst_size = [x * 100 for x in range(1,11)]
    fig = plt.figure(figsize=(10,5))
    ax = plt.subplot(111)
    
    for x in range(5):
        num_lambdas = []
        for y in range(10):
            print (y, data_files[y])
            id_list = set([r['json']['id'] for r in data_files[y]])
            num_lambdas.append(len(id_list))
        data_files = data_files[10:]
        ax.plot(burst_size, num_lambdas, '-', label='{} MB'.format(memory[x]))
    
    plt.plot(burst_size, num_lambdas, '-')
    plt.xlabel('Burst Size', fontsize=16)
    plt.ylabel('Unique Lambdas', fontsize=16)
    plt.title('# of Unique Lambdas That Respond Per Burst')
    ax.legend()
    plt.show()
    plt.savefig('CNT_' + out_prefix + "_" + "_CDF_" + filter + '.png')
    
def cold_per_burst(data_file, out_prefix, x_axis="Burst Size", filter="all"):
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
    plt.savefig('WW'+ "_CDF" + '.png')

def l_cnt_warm(data_file, out_prefix, x_axis="Burst Size", filter="all"):
    #memory = [128,256,512,1024,2048]
    burst_size = [50 * i for i in range(1, 14*2+1)]
    cum_reqs = [sum(burst_size[:x+1]) for x in range(len(burst_size))]

    fig = plt.figure(figsize=(10,5))
    ax = plt.subplot(111)
    
    num_lambdas = []
    for burst in burst_size:
        id_list = set([r['json']['id'] for r in data_file[:burst]])
        num_lambdas.append(len(id_list))
        datafile = data_file[:burst]
    print (num_lambdas)
    ax.plot(burst_size, num_lambdas, '-', label='# of unique lambdas')
    #ax.plot(burst_size, cum_reqs, '-', label='Cumulative Requests Sent')

    plt.xlabel('Burst Size', fontsize=16)
    plt.ylabel('Unique VMs', fontsize=16)
    plt.title('Scaling Bursts for One Function')
    ax.legend()
    plt.show()
    plt.savefig('CNT_' + out_prefix + "_" + x_axis + "_CDF_" + filter + '.png')

if __name__== "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("data_file", help="file containing response data to load")
    parser.add_argument("graph_type", help="which type of graph to generate",
                        choices=["cdf", "3d_cdf", "line", "spawn_cdf", "l_cnt", "l_cnt_warm", "cpb"])
    args, extra_args_raw = parser.parse_known_args()
    
    data_files = load_data_files(args.data_file.split(","))

    extra_args = {s.split("=")[0].replace("--", ""): s.split("=")[1] for s in extra_args_raw}

    out_prefix = os.path.splitext(os.path.basename(args.data_file))[0]

    if args.graph_type == "3d_cdf":
        cdf_3d(data_files[0], out_prefix)
    if args.graph_type == "cdf":
        cdf(data_files, out_prefix, **extra_args)
    if args.graph_type == "line":
        # options: "latency", "cold_v_warm"
        over_time(data_files[0], out_prefix, **extra_args)
    if args.graph_type == "spawn_cdf":
        spawn_cdf(data_files[0], out_prefix, **extra_args)
    if args.graph_type == "l_cnt":
        l_cnt(data_files, out_prefix, **extra_args)
    if args.graph_type == "l_cnt_warm":
        l_cnt_warm(data_files[0], out_prefix, **extra_args)
    if args.graph_type == "cpb":
        cold_per_burst(data_files[0], out_prefix, **extra_args)