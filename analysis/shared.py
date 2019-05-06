import json

def calc_latency(response, method="req_rtt"):
    if method == "upload_rtt_adj":
        tcp_latency = response['timings']['phases']['tcp'] / 2
        client_trigger_time = response['timings']['upload'] - tcp_latency
        return response['json']['triggeredTime'] - client_trigger_time
    elif method == "req_rtt":
        latency = int(response['timings']['response'] - response['timings']['upload'])
        # if latency < 0:
        #     print (response['timings'])
        return latency
# round: this._tick,
# window
# size
# url: url,
# body: response.body,
# timings: response.timings,

def load_data_files(files):
    data_files = []
    for data_file in files:
        print (data_file)
        with open(data_file, 'r') as file:
            data = json.load(file)
            if data['errors']:
                print('{} error responses'.format(len(data['errors'])))
            responses = data['responses']
            for r in responses:
                r['json'] = json.loads(r['body'])
            data_files.append(responses)
    return data_files