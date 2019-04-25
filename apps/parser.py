import matplotlib.pyplot as plt
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
		last_round = 0

		for response in responses:
			last_round = max(last_round, response.round)
			if response.aws_latency > cold_threshold:
				y_warm[response.round] += 1
			elif response.aws_latency < warm_threshold:
				y_cold[response.round] += 1

			if response.runCount > 0:
				y_old[response.round] += 1

		x_time = [0 for i in range(last_round+1)]
		for i in range(last_round+1):
			x_time[i] = (i+1)*window

		plt.plot(x_time, y_cold, 'co', x_time, y_warm, 'r^', x_time, y_old, 'yv')
		plt.xlabel('Time (ms)', fontsize=18)
		plt.ylabel('# of VMs', fontsize=16)

		fig = plt.figure()
		fig.savefig(filename + "_cold_v_warm" + '.jpg')

		results = zip(x_time, y_cold, y_warm, y_old)
		return results

# x_axis: latency
# y_axis: percent
def cdf(x_axis, y_axis):
	responses = sorted(responses, key=lambda response: response.aws_latency)
	points = len(responses)
	y = [0]
	x = [0]
	for i in range(1, points+1):
		x.append(i / points)
		y.append(responses[i].aws_latency)

	plt.plot(x, y, '-')
	plt.xlabel('Latency (ms)', fontsize=18)
	plt.ylabel('%% of VMs', fontsize=16)

	fig = plt.figure()
	fig.savefig(filename + "_latency_CDF" + '.jpg')

	results = zip(x, y)
	return results

def main():
	

if__name__== "__main__":
	main()