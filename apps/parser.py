import matplotlib.pyplot as plt
from matplotlib import cm
import numpy as np

cold_threshold = 200
warm_threshold = 100

# round: this._tick,
# window
# size
# aws_latency: response.body.triggeredTime - response.timings.upload,
# initDuration: response.body.triggeredTime - response.body.initTime,
# runCount: response.body.runCount,
# upload_latency: response.timings.upload - response.timings.start,
# connect_latency: response.timings.connect - response.timings.start,
# url: url,
# body: response.body,
# timings: response.timings,

# x_axis: "tick"
# y_axis: "latency", "cold_v_warm"
def over_time(x_axis, y_axis, filename):

	if y_axis == "latency":
		y_tmp = {}
		last_round = 0
		for response in responses:
			last_round = max(last_round, response.round)
			y_tmp.setdefault(response.round, []).append(response[aws_latency])
		stdev = [0 for i in range(last_round+1)]
		y_avg = [0 for i in range(last_round+1)]
		x_time = [0 for i in range(last_round+1)]
		for i in range(last_round+1):
			stdev[i] = np.std(y_tmp[i])
			y_avg[i] = np.average(y_tmp[i])
			x_time[i] = (i+1)*window

		plt.errorbar(x_time, y_avg, yerr=stdev, 'go')
		plt.xlabel('Time (ms)', fontsize=18)
		plt.ylabel('Latency (ms)', fontsize=16)

		fig = plt.figure()
		fig.savefig(filename + "_latency_time" + '.jpg')

		results = zip(x_time, y_avg, stdev)
		return results

	if y_axis == "cold_v_warm":
		y_cold = [0 for i in range(last_round+1)]
		y_warm = [0 for i in range(last_round+1)]
		y_old = [0 for i in range(last_round+1)]
		y_total = [0 for i in range(last_round+1)]
		last_round = 0

		for response in responses:
			last_round = max(last_round, response.round)
			y_total[response.round] += 1
			if response.aws_latency > cold_threshold:
				y_warm[response.round] += 1
			elif response.aws_latency < warm_threshold:
				y_cold[response.round] += 1

			if response.runCount > 0:
				y_old[response.round] += 1

		x_time = [0 for i in range(last_round+1)]
		for i in range(last_round+1):
			x_time[i] = (i+1)*window

		plt.plot(x_time, y_total, 'k.', x_time, y_cold, 'co', x_time, y_warm, 'r^', x_time, y_old, 'yv')
		plt.xlabel('Time (ms)', fontsize=18)
		plt.ylabel('# of VMs', fontsize=16)

		fig = plt.figure()
		fig.savefig(filename + "_cold_v_warm" + '.jpg')

		results = zip(x_time, y_total, y_cold, y_warm, y_old)
		return results

# x_axis: latency
# y_axis: percent
def cdf(responses = None):
	skip_graph = False
	if resopnses:
		skip_graph = True

	responses = sorted(responses, key=lambda response: response.aws_latency)
	points = len(responses)
	y = [0]
	x = [0]
	for i in range(1, points+1):
		x.append(responses[i].aws_latency)
		y.append(i / points)

	if not skip_graph:
		plt.plot(x, y, '-')
		plt.xlabel('Latency (ms)', fontsize=18)
		plt.ylabel('%% of VMs', fontsize=16)

		fig = plt.figure()
		fig.savefig(filename + "_latency_CDF" + '.jpg')

	return zip(x, y)

# x_axis: latency
# y_axis: round
# z_axis: percent
# yeah this part is gonna be weird
def cdf_3d():
	graph_x = []
	graph_y = []
	graph_z = []

	rounds = [[] for i in range(last_round+1)]
	for response in responses:
		rounds[response.round].append(response)

	for i in rounds:
		for (y, z) in cdf(i):
			graph_x.append(i)
			graph_y.append(y)
			graph_z.append(z)

	fig = plt.figure()
	ax = fig.gca(projection='3d')
	surf = ax.plot_surface(graph_x, graph_y, graph_z, cmap=cm.coolwarm,
                       linewidth=0, antialiased=False)
	fig.savefig(filename + "_cdf_over_time" + '.jpg')


def main():


if__name__== "__main__":
	main()