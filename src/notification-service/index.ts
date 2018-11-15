import axios, {AxiosInstance, AxiosResponse} from 'axios'
import {NotificationServiceConfig} from './notificationServiceConfig'

export class NotificationService {
	/* tslint:disable:variable-name */
	private _http: AxiosInstance

	constructor(config: NotificationServiceConfig) {
		this._http = axios.create({
			baseURL: config.url,
			timeout: config.timeout,
		})
	}

	async sendEmail(templateId: string, email: string, personalisation: object): Promise<AxiosResponse> {
		try {
			return await this._http.post('/notifications/email', {
				personalisation,
				recipient: email,
				templateId,
			}, {
				validateStatus: status => {
					return status === 200
				},
			})
		} catch (error) {
			throw new Error(`Unable to send message: ${error}`)
		}
	}

	set http(value: AxiosInstance) {
		this._http = value
	}
}
