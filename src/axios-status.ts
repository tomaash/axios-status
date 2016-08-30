import {EventEmitter} from 'events'
import axios from 'axios'

export interface AxiosConfig {
	data: string,
	url: string,
	method: string
}

export interface AxiosError {
	response: {
		config: AxiosConfig,
		data: {
			error: string,
			message: string,
			statusCode: number,
			validation: {
				keys: Array<string>,
				source: string
			}
		},
		headers: any,
		request: XMLHttpRequest,
		status: number,
		statusText: string
	},
	message: string,
	config: AxiosConfig,
	stack: any
}

export interface AxiosResponse {
	data: any,
	status: number,
	statusText: string,
	headers: any,
	config: AxiosConfig
}

export interface AxiosStatusOptions {
	timeout: number
	autoRetry: boolean
}

export interface ExecuteRequestOptions {
	url: string
	method?: string
	params?: any
	data?: any
	success: (res: AxiosResponse) => any
	error?: (err: AxiosError) => any
}

export class AxiosStatus extends EventEmitter {
	loadingProgress: number = 0
	disconnected: boolean
	secondsToReconnect: number
	reconnectIntervalHandle: any
	deferredAxiosCalls: Array<any> = []
	axiosInstances: Array<any> = []
	timeout: number = 10
	autoRetry: boolean = false

	constructor(options?: any) {
		super()
		if (options && options.timeout) this.timeout = options.timeout
		if (options && options.autoRetry) this.autoRetry = options.autoRetry
	}

	inc = (param) => {
		console.log(param.url)
		// this.deferredAxiosCall = null
		if (this.loadingProgress === 0) this.emit('busy', true)
		this.loadingProgress += 1
		console.log(this.loadingProgress)
		return param
	}

	dec = (param) => {
		if (this.disconnected === true) this.emit('offline', false)
		this.disconnected = false
		var response = param.status ? param : param.response
		console.log(response.status + ' ' + response.config.url)
		this.loadingProgress -= 1
		if (this.loadingProgress === 0) this.emit('busy', false)
		console.log(this.loadingProgress)
		return param
	}

	err = (param) => {
		this.loadingProgress -= 1
		if (this.loadingProgress === 0) this.emit('busy', false)
		if (param.message === 'Network Error') {
			if (this.disconnected === false) this.emit('offline', true)
			this.disconnected = true
			if (this.autoRetry) {
				// Add current axios call to deferred because network is offline
				this.deferredAxiosCalls.push(param.config)
				this.secondsToReconnect = this.timeout
				this.emit('timer', this.secondsToReconnect)
				// Reset interval on every new network error
				if (this.reconnectIntervalHandle) clearInterval(this.reconnectIntervalHandle)
				this.reconnectIntervalHandle = setInterval(() => {
					this.secondsToReconnect--
					this.emit('timer', this.secondsToReconnect)
					// Auto retry after x seconds
					if (this.secondsToReconnect < 1) {
						clearInterval(this.reconnectIntervalHandle)
						this.retry()
					}
				}, 1000)
			}
		} else {
			// Those are 4xx and 5xx errors, not disconnects, and should not be retried
			if (this.disconnected === true) this.emit('offline', false)
			this.disconnected = false
			var response = param.response
			console.log('ERR ' + response.status + ' ' + response.config.url)
			console.log(this.loadingProgress)
		}
		throw (param)
	}

	register = (axiosInstance: any) => {
		this.axiosInstances.push(axiosInstance)
		axiosInstance.interceptors.request.use(this.inc, this.err)
		axiosInstance.interceptors.response.use(this.dec, this.err)
	}

	request = (config: ExecuteRequestOptions): Promise<AxiosResponse> => {
		return axios.request(config)
			.then(config.success)
			.catch(config.error)
	}

	retry = () => {
		while (this.deferredAxiosCalls.length) {
			const cfg = this.deferredAxiosCalls.shift()
			axios.request(cfg)
				.then(cfg.success)
				.catch(cfg.error || function (err) { throw err })
		}
	}
}

