import matplotlib.pyplot as plt
from matplotlib import cm
import numpy as np
import json
import sys

#aws_latency

def aws_latency(response):
	return json.loads(response['body'])['triggeredTime'] - response['timings']['upload']
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
			y_tmp.setdefault(response['round'], []).append(aws_latency(response))
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
		fig.savefig(filename + "_latency_time" + '.png')

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
		fig.savefig(filename + "_cold_v_warm" + '.png')

		results = zip(x_time, y_total, y_old, y_new)
		return results
	return "valid options: latency or cold_v_warm"

# x_axis: latency
# y_axis: percent
def cdf(responses, options=None):
	responses = sorted(responses, key=lambda response: aws_latency(response))

	if options=="cold":
		cold = []
		for response in enumerate(responses):
			if response['runCount'] == 0:
				cold.append(response)
		responses = cold

	if options=="warm":
		warm = []
		for response in enumerate(responses):
			if response['runCount'] > 0:
				warm.append(response)
		responses = warm

	points = len(responses)
	y = [0]
	x = [0]
	for i in range(0, points):
		x.append(aws_latency(responses[i]))
		y.append(i / points)

	plt.plot(x, y, '-')
	plt.xlabel('Latency (ms)', fontsize=18)
	plt.ylabel('%% of VMs', fontsize=16)

	fig = plt.figure()
	fig.savefig(filename + "_latency_CDF" + '.png')

	return zip(x, y)

def cdf_helper(responses, max_latency, points):
	total = len(responses)
	responses = sorted(responses, key=lambda response: aws_latency(response))
	x = [i*max_latency/(points-1) for i in range(points)]
	y = []
	cur = 0
	for latency in x:
		while responses and aws_latency(responses[0]) <= latency:
			cur += 1
			responses.pop()
		y.append(cur/total)
	return y


# y_axis: latency
# x_axis: round
# z_axis: percent
# yeah this part is gonna be weird
def cdf_3d(responses):
	max_latency = 0
	last_round = 0
	rounds = {}
	for response in responses:
		rounds.setdefault(response['round'], []).append(response)
		max_latency = max(max_latency, aws_latency(response))
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
	fig.savefig(filename + "_cdf_over_time" + '.jpg')

filename = None

def main():
	global filename
	filename = sys.argv[1]
	file = open(filename)
	f_data = json.load(file)
	responses = f_data['responses']

	graph = sys.argv[2]
	options = sys.argv[3] if len(sys.argv) > 3 else None
	if graph == "3d_cdf":
		return cdf_3d(responses)
	if graph == "cdf":
		return cdf(responses, options)
	if graph == "line":
		# options: "latency", "cold_v_warm"
		return over_time(responses, options)

if __name__== "__main__":
	main()
