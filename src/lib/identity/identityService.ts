/* tslint:disable */
import {AxiosInstance} from 'axios'
import {Identity} from './identity'
import * as config from '../config'

export class IdentityService {
	http: AxiosInstance

	constructor(http: AxiosInstance) {
		this.http = http
	}

	async getDetails(token: string) {
		const response = await this.http.get(`/oauth/resolve`, {
			baseURL: config.AUTHENTICATION.serviceUrl,
			headers: {
				Authorization: `Bearer ${token}`,
			},
		})
		const identity = new Identity(response.data.uid, response.data.roles, token)

		return identity
	}

	async getDetailsByEmail(emailAddress: string, token: string) {
		try {
			const response = await this.http.get(`/api/identities/?emailAddress=${emailAddress}`, {
				baseURL: config.AUTHENTICATION.serviceUrl,
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})
			const identity = new Identity(response.data.uid, response.data.roles, token)

			return identity
		} catch (e) {
			if (e.response.status == '404') {
				return null
			} else {
				throw new Error(`Error with GET request: ${e} when getting ${emailAddress} from identity-service`)
			}
		}
	}
}
