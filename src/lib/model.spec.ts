import {expect} from 'chai'
import * as model from 'lib/model'

describe('Should test User roles logic', () => {
	it('User should have role if it was created with it', () => {
		const user = new model.User(
			'id123',
			'test@example.com',
			'session123',
			['learner'],
			''
		)
		user.department = 'commercial'
		user.areasOfWork = ['co']
		user.givenName = 'Test'
		user.grade = 'Test'

		expect(user.hasRole('learner')).to.equal(true)
	})

	it('User have role if was created with it and other roles', () => {
		const user = new model.User(
			'id123',
			'test@example.com',
			'session123',
			['learner', 'management', 'other'],
			''
		)
		user.department = 'commercial'
		user.areasOfWork = ['co']
		user.givenName = 'Test'
		user.grade = 'Test'

		expect(user.hasRole('learner')).to.equal(true)
	})

	it('User should not have role if it was created without it', () => {
		const user = new model.User(
			'id123',
			'test@example.com',
			'session123',
			['management'],
			''
		)
		user.department = 'commercial'
		user.areasOfWork = ['co']
		user.givenName = 'Test'
		user.grade = 'Test'

		expect(user.hasRole('learner')).to.equal(false)
	})

	it('User should not have learner or management role if was created with no roles', () => {
		const user = new model.User(
			'id123',
			'test@example.com',
			'session123',
			[],
			''
		)
		user.department = 'commercial'
		user.areasOfWork = ['co']
		user.givenName = 'Test'
		user.grade = 'Test'

		expect(user.hasRole('learner')).to.equal(false)
		expect(user.hasRole('management')).to.equal(false)
	})

	it('User should not have learner or management role if was created with role in upper case', () => {
		const user = new model.User(
			'id123',
			'test@example.com',
			'session123',
			['Learner'],
			''
		)
		user.department = 'commercial'
		user.areasOfWork = ['co']
		user.givenName = 'Test'
		user.grade = 'Test'

		expect(user.hasRole('learner')).to.equal(false)
	})
})
