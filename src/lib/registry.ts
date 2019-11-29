import axios, {AxiosResponse} from 'axios'
import * as config from 'lib/config'
import * as log4js from 'log4js'
import * as traverson from 'traverson'
import * as hal from 'traverson-hal'

const logger = log4js.getLogger('registry')

const http = axios.create({
	baseURL: config.CHECK_LINEMANAGER_URL,
	headers: {
		'Content-Type': 'application/json',
	},
	timeout: config.REQUEST_TIMEOUT,
})

// register the traverson-hal plug-in for media type 'application/hal+json'
traverson.registerMediaType(hal.mediaType, hal)

export async function get(node: string): Promise<{}> {
	const result = await new Promise((resolve, reject) =>
		traverson
			.from(config.REGISTRY_SERVICE_URL)
			.jsonHal()
			.follow(node, 'self')
			.withRequestOptions({
				qs: { size: 100, page: 0},
			})			.getResource((error, document) => {
				if (error) {
					reject(false)
				} else {
					resolve(document)
				}
			})
	)

	return result as any[]
}

export async function halNode(node: string): Promise<any[]> {
	const result = await get(node)
	return (result as any)._embedded[node]
}

export async function follow(
	path: string,
	nodes: string[],
	templateParameters?: any
) {
	if (nodes.length === 0) {
		nodes = ['self']
	}

	const first = nodes[0]
	nodes.shift()

	const result = await new Promise((resolve, reject) => {
		const builder = traverson
			.from(path)
			.jsonHal()
			.follow(first, ...nodes)

		if (templateParameters) {
			builder.withTemplateParameters(templateParameters!)
		}

		builder.getResource((error, document) => {
			if (error) {
				logger.error(error)
				reject(false)
			} else {
				resolve(document)
			}
		})
	})

	return result
}

export async function checkLineManager(data: any, token: string) {
	const result = await new Promise((resolve, reject) => {
		http
			.patch(`?email=${data.lineManager}`, null, {
				headers: {Authorization: `Bearer ${token}`},
			})
			.then((response: any) => {
				resolve(response)
			})
			.catch((error: any) => {
				resolve(error.response)
			})
	})
	return result
}

export async function patch(node: string, data: any, token: string) {
	const result = await new Promise((resolve, reject) =>
		traverson
			.from(config.REGISTRY_SERVICE_URL)
			.jsonHal()
			.follow(node, 'me', 'self')
			.withRequestOptions({
				auth: {
					bearer: token,
				},
			})
			.patch(data, (error, document) => {
				if (error) {
					reject(false)
				} else {
					resolve(true)
				}
			})
	)

	return result
}

export async function profile(token: string) {
	return await new Promise((resolve, reject) =>
		traverson
			.from(config.REGISTRY_SERVICE_URL)
			.jsonHal()
			.follow('civilServants', 'me')
			.withRequestOptions({
				auth: {
					bearer: token,
				},
			})
			.getResource((error, document) => {
				if (error) {
					reject(error)
				} else {
					resolve(document)
				}
			})
	)
}

export async function getWithoutHal(path: string): Promise<AxiosResponse> {
	try {
		return await http.get(config.REGISTRY_SERVICE_URL + path)
	}	catch (error) {
		throw new Error(error)
	}
}

export async function patchProfile(token: string, data: any): Promise<AxiosResponse> {
	return await new Promise<AxiosResponse>((resolve, reject) => {
		http
			.patch(config.REGISTRY_SERVICE_URL + '/civilServants/profile', data, {
				headers: {Authorization: `Bearer ${token}`},
			})
			.then((response: any) => {
				resolve(response)
			})
			.catch((error: any) => {
				resolve(error.response)
			})
	})
}
