import {expect} from 'chai'
import {
	constructCourseCallToAction,
	CourseActionType,
} from 'lib/ui/courseCallToAction'

import {CourseRecord, ModuleRecord} from 'lib/learnerrecord'
import {Course, Module, User} from 'lib/model'

const courseSkeletonData: any = {
	id: 'UT0',
	title: 'Unit Test Course Skeleton',

	description: '',
	duration: '',
	learningOutcomes: '',
	price: 'Free',
	shortDescription: '',

	modules: [{}],
}

const moduleData: {[module: string]: any} = {
	faceToFace: {
		description: '',
		duration: null,
		id: 'F2F',
		optional: true,
		price: null,
		productCode: null,
		title: 'Face to face module',
		type: 'face-to-face',

		events: [
			{
				capacity: 30,
				dateRanges: [{date: '2019-10-10', startTime: '06:00:00'}],
				id: 'past',
				venue: {location: 'London'},
			},
			{
				capacity: 30,
				dateRanges: [{date: '2019-10-10', startTime: '06:00:00'}],
				id: 'future',
				venue: {location: 'London'},
			},
		],
	},
	file: {
		description: 'File',
		duration: 1000,
		events: [],
		fileSize: null,
		id: 'FILE',

		optional: true,

		price: null,
		type: 'file',

		title: 'tes',
		url: null,
	},
}

export const testUser = User.create({
	accessToken: '',
	id: '3c706a70-3fff-4e7b-ae7f-102c1d46f569',
	userName: 'learner@domain.com',

	department: 'co',
	grade: 'PB3',

	areasOfWork: ['Commercial'],
	otherAreasOfWork: ['Finance', 'Fraud, error, debt and grants', 'Digital'],
	roles: ['LEARNER'],

	sessionIndex: '',
})

describe('Course Call to Actions', () => {
	let course: Course
	let modifier: string
	beforeEach(() => {
		course = initCourse()
	})
	it('should return a CourseCallToAction struct', () => {
		/* tslint:disable:no-unused-expression */
		expect(constructCourseCallToAction(course)).to.exist
		/* tsline:enable */
	})

	describe('For unrequired courses', () => {
		describe('That are not in the learning plan', () => {
			it('isInLearningPlan should be false', () => {
				expect(
					constructCourseCallToAction(course).isInLearningPlan
				).to.be.false
			})

			it('for bookable courses it should return "action_BOOK"', () => {
				course = initCourse()
				course.modules = initModules(['faceToFace'])
				const cta = constructCourseCallToAction(course)
				expect(cta.message).to.equal('action_BOOK')
			})

			describe('on search page', () => {
				beforeEach(() => {
					modifier = 'search'
				})

				it('should return Add (to learning plan)', () => {
					course.modules = initModules(['file'])
					const cta = constructCourseCallToAction(course, modifier)
					expect(cta.actionToPlan!.type).to.be.equal(CourseActionType.Add)
				})
			})

			describe('on home page', () => {
				beforeEach(() => {
					modifier = 'home'
				})

				it('should not return Add (to learning plan)', () => {
					course.modules = initModules(['file'])
					const cta = constructCourseCallToAction(course, modifier)
					expect(cta.actionToPlan).to.be.undefined
				})
			})
		})

		describe('That are in the learning plan', () => {
			beforeEach(() => {
				course = initCourse(true)
			})
			it('should be in the learning plan', () => {
				expect(
					constructCourseCallToAction(course).isInLearningPlan
				).to.be.equal(true)
			})

			describe('on the search page', () => {
				beforeEach(() => {
					modifier = 'search'
				})
				it('should not have any actions to plan', () => {
					expect(
						constructCourseCallToAction(course, modifier).actionToPlan
					).to.be.undefined
				})
			})
			describe('on the home page', () => {
				beforeEach(() => {
					modifier = 'home'
				})
				describe('for unrequired courses', () => {
					it('should have actions to plan', () => {
						expect(
							constructCourseCallToAction(course, modifier)
								.actionToPlan
						).to.exist
					})
					describe('for face to face courses that have been REGISTERED', () => {
						beforeEach(() => {
							course.modules = initModules(['faceToFace'])
						})
						describe('where the date today has not passed the event date', () => {
							// it('', () => {
							// 	course.record!.modules.push(initModuleRecord('future'))
							// 	course.record!.modules[0].state = 'REGISTERED'
							// 	expect(
							// 		constructCourseCallToAction(course, modifier)
							// 			.message
							// 	).to.be.equal('action_CANCEL')
							// })
							it('should show "Remove" and "Book" for UNREGISTERED courses', () => {
								course.record!.modules.push(initModuleRecord('future'))
								course.record!.modules[0].state = 'UNREGISTERED'

								const cta = constructCourseCallToAction(
									course,
									modifier
								)

								expect(cta.url).to.be.equal(`/book/${course.id}/${course.modules[0].id}/choose-date`)
								expect(cta.message).to.be.equal('action_BOOK')
								expect(cta.actionToPlan!.type).to.be.equal(CourseActionType.Delete)
							})
						})
					})
				})
			})
		})
	})

	describe('For required courses', () => {
		it('should not have any actions to learning plan on search pages', () => {
			course.modules = initModules(['file'])
			course.isRequired = () => true
			const cta = constructCourseCallToAction(course, 'search')

			expect(cta.actionToPlan).to.be.undefined
		})
		it('should not have any actions to learning plan on home', () => {
			course.modules = initModules(['file'])
			course.isRequired = () => true
			const cta = constructCourseCallToAction(course, 'home')
			expect(cta.actionToPlan).to.be.undefined
		})
		describe('that are bookable', () => {
			beforeEach(() => {
				course = initCourse(true)
				course.modules = initModules(['faceToFace'])
				course.isRequired = () => true
			})
			it('should return "action_BOOK" for bookable courses', () => {
				const cta = constructCourseCallToAction(course)
				expect(cta.message).to.be.equal('action_BOOK')
			})

			it('should not have cancel actions if booked', () => {
				course.record!.modules[0] = initModuleRecord('future')
				const cta = constructCourseCallToAction(course, 'home')

				expect(cta.message).to.be.equal('action_BOOK')
			})
		})
	})
})

export function initCourse(withRecord?: boolean): Course {
	const c = Course.create(courseSkeletonData)
	if (withRecord) {
		c.record = new CourseRecord({
			courseId: c.id,
			courseTitle: 'title',
			modules: [],
			state: 'IN_PROGRESS',
			userId: testUser.id,
		})
	}
	return c
}

export function initModules(moduleNames: string[]): Module[] {
	const modules: Module[] = []
	for (const module of moduleNames) {
		modules.push(Module.create(moduleData[module]))
	}
	return modules
}

type EventRelativeToToday = 'past' | 'future'

function initModuleRecord(rel: EventRelativeToToday): ModuleRecord {
	return {
		eventId: rel,
		moduleId: 'F2F',
		moduleTitle: 'module',
		moduleType: 'blog',
		optional: true,
	}
}
