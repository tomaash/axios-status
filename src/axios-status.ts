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
	timeout?: number
	autoRetry?: boolean
}

export interface ExecuteRequestOptions {
	url: string
	method?: string
	params?: any
	data?: any
	instance?: any
	success: (res: AxiosResponse) => any
	error?: (err: AxiosError) => any
	transformRequest?: any
	transformResponse?: any
	headers?: any;
	paramsSerializer?: (params: any) => string;
	timeout?: number;
	withCredentials?: boolean;
	adapter?: any
	auth?: any
	responseType?: string;
	xsrfCookieName?: string;
	xsrfHeaderName?: string;
	onUploadProgress?: (progressEvent: any) => void;
	onDownloadProgress?: (progressEvent: any) => void;
	maxContentLength?: number;
	validateStatus?: (status: number) => boolean;
	maxRedirects?: number;
	httpAgent?: any;
	httpsAgent?: any;
	proxy?: any;
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

	constructor(options?: AxiosStatusOptions) {
		super()
		if (options && options.timeout) this.timeout = options.timeout
		if (options && options.autoRetry) this.autoRetry = options.autoRetry
	}

	inc = (param) => {
		// this.deferredAxiosCall = null
		if (this.loadingProgress === 0) this.emit('busy', true)
		this.loadingProgress += 1
		return param
	}

	dec = (param) => {
		if (this.disconnected === true) this.emit('offline', false)
		this.disconnected = false
		var response = param.status ? param : param.response
		this.loadingProgress -= 1
		if (this.loadingProgress === 0) this.emit('busy', false)
		return param
	}

	err = (param) => {
		this.loadingProgress -= 1
		if (this.loadingProgress === 0) this.emit('busy', false)
		if (param.message === 'Network Error') {
			if (this.disconnected === false) this.emit('offline', true)
			this.disconnected = true
			// Add current axios call to deferred because network is offline
			this.deferredAxiosCalls.push(param.config)
			if (this.autoRetry) {
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
		}
		throw (param)
	}

	register = (axiosInstance: any) => {
		this.axiosInstances.push(axiosInstance)
		axiosInstance.interceptors.request.use(this.inc, this.err)
		axiosInstance.interceptors.response.use(this.dec, this.err)
	}

	request = (config: ExecuteRequestOptions): Promise<AxiosResponse> => {
		return (config.instance || axios).request(config)
			.then(config.success)
			.catch(config.error || function (err) { throw err })
	}

	retry = () => {
		while (this.deferredAxiosCalls.length) {
			const cfg = this.deferredAxiosCalls.shift()
			this.request(cfg)
		}
	}
}

