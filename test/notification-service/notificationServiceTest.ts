/* tslint:disable */

import {AxiosInstance, AxiosResponse} from 'axios'
import {NotificationService} from '../../src/notification-service'
import {NotificationServiceConfig} from '../../src/notification-service/notificationServiceConfig'
import * as sinon from 'sinon'
import * as chai from 'chai'
import {expect} from 'chai'
import * as chaiAsPromised from 'chai-as-promised'

import * as sinonChai from 'sinon-chai'

chai.use(chaiAsPromised)
chai.use(sinonChai)


describe('NotificationService tests', () => {
	let http: AxiosInstance
	let notificationService: NotificationService

	before(() => {
		http = <AxiosInstance>{}
		notificationService = new NotificationService(new NotificationServiceConfig())
		notificationService.http = http
	})

	// @ts-ignore
	it('should send email', async () => {
		const templateId = 'template-id'
		const email = 'user@domain.org'
		const personalisation = {
			name: 'Test User',
			courseId: 'course-id'
		}

		const response = <AxiosResponse>{
			status: 200,
			data: {
				personalisation,
				recipient: email,
				templateId: templateId
			}
		}

		// @ts-ignore
		http.post = sinon.stub().returns(response)

		const result = await notificationService.sendEmail(templateId, email, personalisation)

		expect(result).to.equal(response)
		expect(http.post).to.have.been.calledOnceWith('/notifications/email', {
			personalisation,
			recipient: email,
			templateId
		})
	})

	// @ts-ignore
	it('should catch error', async () => {
		const templateId = 'template-id'
		const email = 'user@domain.org'
		const personalisation = {
			name: 'Test User',
			courseId: 'course-id'
		}

		// @ts-ignore
		http.post = sinon.stub().throws(new Error("This is a test error"))

		expect(
			notificationService.sendEmail(templateId, email, personalisation)
		).to.be.rejectedWith(new Error('Error: Unable to send message: Error: This is a test error'))

		expect(http.post).to.have.been.calledOnceWith('/notifications/email', {
			personalisation,
			recipient: email,
			templateId
		})
	})

})