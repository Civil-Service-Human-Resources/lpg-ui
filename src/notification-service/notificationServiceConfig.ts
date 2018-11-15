/* tslint:disable:variable-name */
import * as config from '../lib/config'

export class NotificationServiceConfig {
	private _url: string
	private _timeout: number

	constructor(url: string = config.NOTIFICATION_SERVICE.url, timeout: number = config.NOTIFICATION_SERVICE.timeout) {
		this._url = url
		this._timeout = timeout
	}

	get url(): string {
		return this._url
	}

	set url(value: string) {
		this._url = value
	}

	get timeout(): number {
		return this._timeout
	}

	set timeout(value: number) {
		this._timeout = value
	}
}
