# Network requests status tracking for Axios

This package can be used to trace status of all Axios requests for the purpose of application-wide progress indicator

## Installation:

`npm install axios-status --save`

## Usage:

First, create a new instance of AxiosStatus, and register your axios instances with it. You can provide following options to constructor

```js
const axiosStatus = new AxiosStatus({
  timeout: 20, // default 10
  autoRetry: true // default false
})

axiosStatus.register(axios)
axiosStatus.register(mySpecialAxiosInstance)
```

The `autoRetry` options specifies if `axiosStatus` should auto retry all failed requests after given `timeout` (seconds)

Then, you can subscribe on `AxiosStatus` events to be able to show them in UI. 

* The `busy` event has values of `true / false` and signals that there are XHR requests in progress
* The `offline` event has values of `true / false` and signals that request failed because network is temporariy down
* The `timer` event emits a number that signals seconds to next auto-retry


```js
axiosStatus.on('busy', (val) => this.loadingProgress = val)
axiosStatus.on('offline', (val) => this.disconnected = val)
axiosStatus.on('timer', (val) => this.secondsToReconnect = val)
```

To be able to correctly run a callback on auto-retry, you need to use `axiosStatus.request`. It supports all axios request options, plus `success` callback, `error` callback, and `instance` to specify axios instance on which this request should be run. 

```js
axiosStatus.request({
  instance: mySpecialAxiosInstance,	
  method: 'get',
  url: API_URL + '/me',
  success: (res) => {
    this.user = res.data
  },
  error: (err) => {
  	throw err
  }
})
```

To retry manually, you can just call `axiosStatus.retry()` to retry all calls initiated when offline
