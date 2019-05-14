# Autocannon Max Response Rate

Autocannon seems to be the gold-standard in Node.js based HTTP request engines. Let's
see how many responses it can handle per millisecond.

Given `$INPUT` is a list of response times (millisecond granularity), this will
produce a list of how many different times had X requests in that ms. The first
column will be occurences, and the second will be number of requests in a millisecond.

```
$INPUT | sort -n | uniq -c | awk '{print $1}' | sort -n | uniq -c`
```

When running `experiments/autocannon/index.js` then `$INPUT` can just be `cat $DATE.responses` with
`$DATE` being when the test was run (look at the output files from the test).

When looking at `engine_runner.js` output, use
`cat $RESULT_FILE | jq '.responses[].timings.response' | awk -F '.' '{print $1}'` as
`$INPUT`.

## Results

**For _https://alexwendland.com_**

* Autocannon, with 300 connections & 15 pipelining
  * Has over 20 responses per ms for the vast majority of responses.
* Autocannon, with 300 connections & no pipelining
  * Peaks at 2 instances of 13 per ms, 6 of 12, 14 of 11, 20 of 10, 55 of 9, 101 of 8...
* got, with 1000 rpw
  * Peaks at 129 instances of 3 per ms, 220 of 2, 23 of 1.
* https.request, with 300 rpw
  * Peaks at 10 instances of 6 per ms, 21 of 5, 13 of 4, 21 of 3.
* https.request w/o http-hrtimers, with 300 rpw
  * For http_parser.c: Peaks at 3 instances of 8 per ms, 22 of 7, 7 of 6, 7 of 5...
  * For http-parser-js: Peaks at 6 instances of 7 per ms, 21 of 6, 14 of 5...
* manual https impl, with 300 rpw
  * Peaks at 4 instances of 14 per ms, 6 of 13, 2 of 12, 1 of 11, 2 of 10...