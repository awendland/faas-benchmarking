import json

def calc_latency(response):
    latency = response['endTime'] - response['startTime'] - int(response['processingTime'])
    if latency < 0:
        raise ValueError("error neg req rtt")
    else:
        return latency

def load_data_files(files):
    data_files = []
    for data_file in files:
        print (data_file)
        with open(data_file, 'r') as file:
            data = json.load(file)
            df = {}
            df['params'] = data['params']
            df['responses'] = data['responses']
            data_files.append(df)
    return data_files