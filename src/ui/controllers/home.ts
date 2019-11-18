import * as express from 'express'
import * as config from 'lib/config'
import * as datetime from 'lib/datetime'
import * as extended from 'lib/extended'
import * as learnerRecord from 'lib/learnerrecord'
import * as model from 'lib/model'
import * as catalog from 'lib/service/catalog'
import * as template from 'lib/ui/template'
import * as log4js from 'log4js'
import * as suggestionController from './suggestion'

const logger = log4js.getLogger('controllers/home')

export async function home(req: express.Request, res: express.Response, next: express.NextFunction) {
	logger.debug(`Getting learning record for ${req.user.id}`)
	try {
		const user = req.user as model.User

		const [learningRecord, requiredLearningResults] = await Promise.all([
			learnerRecord.getRawLearningRecord(user),
			catalog.findRequiredLearning(user),
		])
		const requiredLearning = requiredLearningResults.results
		const learningHash = suggestionController.hashArray(
			learningRecord,
			'courseId'
		)

		const readyForFeedback = await learnerRecord.countReadyForFeedback(
			learningRecord
		)
		for (let i = 0; i < requiredLearning.length; i++) {
			const requiredCourse = requiredLearning[i]
			if (learningHash[requiredCourse.id]) {
				const record = learningHash[requiredCourse.id]
				if (record) {
					requiredCourse.record = record
					if (record.isComplete()) {
						if (!requiredCourse.shouldRepeat()) {
							requiredLearning.splice(i, 1)
							i -= 1
						}
					} else {
						if (!record.state && record.modules && record.modules.length) {
							record.state = 'IN_PROGRESS'
						}
					}
					learningRecord.splice(
						learningRecord.findIndex(
							value => value.courseId === record.courseId
						),
						1
					)
				}
			}
		}

		const bookedLearning: learnerRecord.CourseRecord[] = []
		let plannedLearning: learnerRecord.CourseRecord[] = []
		for (const record of learningRecord) {
			if (!record.isComplete() && learnerRecord.isActive(record)) {
				if (!record.state && record.modules && record.modules.length) {
					record.state = 'IN_PROGRESS'
				}
				if (record.getSelectedDate()) {
					const bookedModuleRecord = record.modules.find(m => !!m.eventId)
					if (bookedModuleRecord) {
						record.state = bookedModuleRecord.bookingStatus
					}
					bookedLearning.push(record)
				} else {
					plannedLearning.push(record)
				}
			}
		}

		bookedLearning.sort((a, b) => {
			return a.getSelectedDate()!.getDate() - b.getSelectedDate()!.getDate()
		})

		plannedLearning = [...bookedLearning, ...plannedLearning]

		const courses = await catalog.list(
			plannedLearning.map(l => l.courseId),
			user
		)
		for (const course of courses) {
			course.record = plannedLearning.find(l => l.courseId === course.id)
		}

		let removeCourseId
		let confirmTitle
		let confirmMessage
		let eventActionDetails
		let action = ''
		let yesOption
		let noOption

		if (req.query.delete) {
			const courseToDelete = await catalog.get(req.query.delete, user)
			confirmTitle = req.__(
				'learning_confirm_removal_plan_title',
				courseToDelete!.title
			)
			removeCourseId = courseToDelete!.id
			confirmMessage = req.__('learning_confirm_removal_plan_message')
		}

		if (req.query.skip) {
			action = 'skip'
		}

		if (req.query.move) {
			action = 'move'
		}

		if (req.query.skip || req.query.move) {
			eventActionDetails = req.query[action].split(',')
			eventActionDetails.push(action)
			const module = await catalog.get(eventActionDetails[0], user)

			confirmTitle = req.__(
				'learning_confirm_' + action + '_plan_title',
				module!.title
			)

			confirmMessage = req.__('learning_confirm_' + action + '_plan_message')
			yesOption = req.__('learning_confirm_' + action + '_yes_option')
			noOption = req.__('learning_confirm_' + action + '_no_option')
		}
		res.send(
			template.render('home', req, res, {
				bookedLearning,
				confirmMessage,
				confirmTitle,
				eventActionDetails,
				formatEventDuration,
				getModuleForEvent,
				isEventBookedForGivenCourse,
				noOption,
				plannedLearning: courses,
				readyForFeedback,
				removeCourseId,
				requiredLearning,
				successId: req.flash('successId')[0],
				successMessage: req.flash('successMessage')[0],
				successTitle: req.flash('successTitle')[0],
				yesOption,
			})
		)
	} catch (e) {
		console.error("Error building user's home page", e)
		next(e)
	}
}

function formatEventDuration(duration: number) {
	return datetime.formatCourseDuration(duration)
}

function filterCourseByEvent(course: model.Course) {
	return (
		course.record &&
		course.record.modules.filter(
			(module: any) => module.moduleType === 'face-to-face' && module.eventId
		)
	)
}

export function isEventBookedForGivenCourse(course: model.Course) {
	return filterCourseByEvent(course)!.length > 0
}

export function getModuleForEvent(course: model.Course) {
	return filterCourseByEvent(course)!.pop()
}

export function index(req: express.Request, res: express.Response) {
	if (req.isAuthenticated()) {
		res.redirect('/home')
	} else {
		res.redirect('/sign-in')
	}
}

export function cookies(ireq: express.Request, res: express.Response) {
	res.cookie('seen_cookie_message', 'yes')

	const req = ireq as extended.CourseRequest
	res.send(template.render('/cookies', req, res, {}))
}

export function contactUs(req: express.Request, res: express.Response) {
	res.send(template.render('/contact-us', req, res, {
		contactEmail: config.CONTACT_EMAIL,
		contactNumber: config.CONTACT_NUMBER,
	}))
}
