import matplotlib.pyplot as plt
from matplotlib import cm
import numpy as np
import json
import sys
import os
import argparse

#aws_latency

def calc_latency(response, method="upload_rtt_adj"):
    if method == "upload_rtt_adj":
        tcp_latency = response['timings']['phases']['tcp'] / 2
        client_trigger_time = response['timings']['upload'] - tcp_latency
        return response['json']['triggeredTime'] - client_trigger_time
    elif method == "req_rtt":
        return response['timings']['response'] - response['timings']['upload']
# round: this._tick,
# window
# size
# url: url,
# body: response.body,
# timings: response.timings,

# x_axis: "tick"
# y_axis: "latency", "cold_v_warm"
def over_time(responses, y_axis):
    window = responses[0].window

    if y_axis == "latency":
        y_tmp = {}
        last_round = 0
        for response in responses:
            last_round = max(last_round, response['round'])
            y_tmp.setdefault(response['round'], []).append(calc_latency(response))
        stdev = [0 for i in range(last_round+1)]
        y_avg = [0 for i in range(last_round+1)]
        x_time = [0 for i in range(last_round+1)]
        for i in range(last_round+1):
            stdev[i] = np.std(y_tmp[i])
            y_avg[i] = np.average(y_tmp[i])
            x_time[i] = (i+1)*window

        plt.errorbar(x_time, y_avg, yerr=stdev, fmt='go')
        plt.xlabel('Time (ms)', fontsize=18)
        plt.ylabel('Latency (ms)', fontsize=16)

        fig = plt.figure()
        fig.savefig(out_prefix + "_latency_time" + '.png')

        results = zip(x_time, y_avg, stdev)
        return results

    if y_axis == "cold_v_warm":
        y_new = [0 for i in range(last_round+1)]
        y_old = [0 for i in range(last_round+1)]
        y_total = [0 for i in range(last_round+1)]
        last_round = 0

        for response in responses:
            last_round = max(last_round, response['round'])
            y_total[response['round']] += 1
            if response["runCount"] > 0:
                y_old[response['round']] += 1
            else:
                y_new[response['round']] += 1

        x_time = [0 for i in range(last_round+1)]
        for i in range(last_round+1):
            x_time[i] = (i+1)*window

        plt.plot(x_time, y_total, 'k.', x_time, y_new, 'co', x_time, y_old, 'g^')
        plt.xlabel('Time (ms)', fontsize=18)
        plt.ylabel('# of VMs', fontsize=16)

        fig = plt.figure()
        fig.savefig(out_prefix + "_cold_v_warm" + '.png')

        results = zip(x_time, y_total, y_old, y_new)
        return results
    return "valid options: latency or cold_v_warm"

# x_axis: latency
# y_axis: percent
def cdf(responses, out_prefix, filter="all", latency="upload_rtt_adj"):
    filtered_resp = sorted(responses, key=lambda response: calc_latency(response, method=latency))

    if filter=="cold":
        resp = []
        for response in filtered_resp:
            if response['json']['runCount'] == 1:
                resp.append(response)
        filtered_resp = resp

    if filter=="warm":
        resp = []
        for response in filtered_resp:
            if response['json']['runCount'] > 1:
                resp.append(response)
        filtered_resp = resp

    num_points = len(filtered_resp)
    x = [0]
    y = [0]
    for i in range(0, num_points):
        x.append(calc_latency(filtered_resp[i], method=latency))
        y.append(float(i) / num_points * 100)

    plt.plot(x, y, '-')
    plt.xlabel('Latency (ms, {})'.format(latency), fontsize=18)
    plt.ylabel('% of VMs (n={})'.format(num_points), fontsize=16)
    plt.show()
    plt.savefig(out_prefix + "_latency_CDF_" + latency + "_" + filter + '.png')

    print(zip(x, y))
    return zip(x, y)

def cdf_helper(responses, max_latency, points):
    total = len(responses)
    responses = sorted(responses, key=lambda response: calc_latency(response))
    x = [i*max_latency/(points-1) for i in range(points)]
    y = []
    cur = 0
    for latency in x:
        while responses and calc_latency(responses[0]) <= latency:
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
        max_latency = max(max_latency, calc_latency(response))
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

if __name__== "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("data_file", help="file containing response data to load")
    parser.add_argument("graph_type", help="which type of graph to generate",
                        choices=["cdf", "3d_cdf", "line"])
    args, extra_args_raw = parser.parse_known_args()
    with open(args.data_file, 'r') as data_file:
        data = json.load(data_file)
        if data['errors']:
            print('{} error responses'.format(len(data['errors'])))
        responses = data['responses']
        for r in responses:
            r['json'] = json.loads(r['body'])

    extra_args = {s.split("=")[0].replace("--", ""): s.split("=")[1] for s in extra_args_raw}

    out_prefix = os.path.splitext(os.path.basename(args.data_file))[0]

    if args.graph_type == "3d_cdf":
        cdf_3d(responses, out_prefix)
    if args.graph_type == "cdf":
        cdf(responses, out_prefix, **extra_args)
    if args.graph_type == "line":
        # options: "latency", "cold_v_warm"
        over_time(responses, out_prefix, **extra_args)
