package main

import (
	"crypto/tls"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/http/httptrace"
	"time"
)

// timedresponse is a collection of http response data and timing information
// about the http request
type timedresponse struct {
	tdnsstart, tdnsdone, tconnect, tupload, trespstart,
	trespdone, ttlsstart, ttlsdone time.Time
	body []byte
}

func timeRequest(client *http.Client, method, url string) *timedresponse {
	var tdnsstart, tdnsdone, tconnect, tupload, trespstart, trespdone, ttlsstart, ttlsdone time.Time

	trace := &httptrace.ClientTrace{
		DNSStart: func(_ httptrace.DNSStartInfo) { tdnsstart = time.Now() },
		DNSDone:  func(_ httptrace.DNSDoneInfo) { tdnsdone = time.Now() },
		ConnectStart: func(_, _ string) {
			if tdnsdone.IsZero() {
				// IP used
				tdnsdone = time.Now()
			}
		},
		ConnectDone: func(net, addr string, err error) {
			if err != nil {
				log.Fatalf("unable to connect to host %v: %v", addr, err)
			}
			tconnect = time.Now()

			log.Printf("Connected to %s\n", addr)
		},
		GotConn:              func(_ httptrace.GotConnInfo) { tupload = time.Now() },
		GotFirstResponseByte: func() { trespstart = time.Now() },
		TLSHandshakeStart:    func() { ttlsstart = time.Now() },
		TLSHandshakeDone:     func(_ tls.ConnectionState, _ error) { ttlsdone = time.Now() },
	}
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		log.Fatalf("unable to create request: %v", err)
	}
	tracedReq := req.WithContext(httptrace.WithClientTrace(req.Context(), trace))
	resp, err := client.Do(tracedReq)
	if err != nil {
		fmt.Errorf("failed to read response: %v", err)
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	trespdone = time.Now()
	// log.Printf("%d with payload of %d bytes\n", resp.StatusCode, len(body))
	return &timedresponse{
		tdnsstart, tdnsdone, tconnect, tupload, trespstart, trespdone, ttlsstart, ttlsdone,
		body,
	}
}

func timeRequestWorker(client *http.Client, method, url string, c chan *timedresponse) {
	t := timeRequest(client, method, url)
	c <- t
}

func main() {
	tr := &http.Transport{
		MaxIdleConns:        1024,
		MaxIdleConnsPerHost: 0,
		IdleConnTimeout:     2 * time.Minute,
		DisableCompression:  true,
	}
	client := &http.Client{
		Transport: tr,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}}
	url := "https://alexwendland.com:443"
	numReqs := 100
	timeRequest(client, "HEAD", url)
	c := make(chan *timedresponse)
	for i := 0; i < numReqs; i++ {
		go timeRequestWorker(client, "GET", url, c)
	}
	log.Printf("Responses came in at:")
	for u := 0; u < numReqs; u++ {
		t := <-c
		// total := t.trespdone.Sub(t.tdnsstart)
		// if t.tconnect.IsZero() {
		// 	total = t.trespdone.Sub(t.tupload)
		// }
		fmt.Printf("%s\n", (t.trespstart).Format("15:04:05.0000"))
		// log.Printf("dns=%s tcp=%s tls=%s process=%s download=%s total=%s",
		// 	t.tdnsdone.Sub(t.tdnsstart).String(),
		// 	t.tconnect.Sub(t.tdnsdone).String(),
		// 	t.ttlsdone.Sub(t.ttlsstart).String(),
		// 	t.trespstart.Sub(t.tupload).String(),
		// 	t.trespdone.Sub(t.trespstart).String(),
		// 	total.String())
	}
	log.Printf("done")
}
