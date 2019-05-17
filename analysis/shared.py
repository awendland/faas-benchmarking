import json

def calc_latency(response, method="req_rtt"):
    if method == "upload_rtt_adj":
        tcp_latency = response['timings']['phases']['tcp'] / 2
        client_trigger_time = response['timings']['upload'] - tcp_latency
        return response['json']['triggeredTime'] - client_trigger_time
    elif method == "req_rtt":
        latency = response['response'] - response['upload'] - response['sleep_dur']
        return latency
    elif method == "req_upload_rtt":
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
            df = []
            try:
                df['params'] = json.loads(data['params'])
            except json.JSONDecodeError:
                df['params'] = {}

            responses = []
            for r in data['responses']:
                try:
                    r.append(json.loads(r))
                except json.JSONDecodeError:
                    continue
            df['responses'] = responses

            # if data['errors']:
            #     print('{} error responses'.format(len(data['errors'])))
            # responses = data['responses']
            # for r in responses:
            #     try:
            #         r['json'] = json.loads(r['body'])
            #     except json.JSONDecodeError:
            #         r['json'] = {}
            data_files.append(df)
    return data_files