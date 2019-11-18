import * as express from 'express'
import * as extended from 'lib/extended'
import * as learnerRecord from 'lib/learnerrecord'
import * as model from 'lib/model'
import {ApiParameters} from "lib/service/catalog"
import * as catalog from 'lib/service/catalog'
import * as template from 'lib/ui/template'
import * as xapi from 'lib/xapi'
import * as log4js from 'log4js'

const logger = log4js.getLogger('controllers/suggestion')

export function hashArray<T>(records: T[], key: string) {
	const hash: Record<string, T> = {}
	for (const entry of records) {
		const hashIndex: string = (entry as any)[key]
		hash[hashIndex] = entry
	}
	return hash
}
export async function addToPlan(ireq: express.Request, res: express.Response) {
	const req = ireq as extended.CourseRequest
	const ref = req.query.ref
	const course = req.course

	let redirectTo = '/suggestions-for-you'
	switch (ref) {
		case 'home':
		case 'search':
			redirectTo = '/'
			break
	}
	try {
		await xapi.record(req, course, xapi.Verb.Liked)

		req.flash(
			'successTitle',
			req.__('learning_added_to_plan_title', course.title)
		)
		req.flash(
			'successMessage',
			req.__('learning_added_to_plan_message', course.title)
		)
		req.flash('successId', course.id)
		req.session!.save(() => {
			res.redirect(redirectTo)
		})
	} catch (err) {
		logger.error('Error recording xAPI statement', err)
		res.sendStatus(500)
	}
}
export async function removeFromSuggestions(
	ireq: express.Request,
	res: express.Response
) {
	const req = ireq as extended.CourseRequest
	const ref =
		req.query.ref === 'home' || req.query.ref === 'search'
			? '/'
			: '/suggestions-for-you'
	const course = req.course

	try {
		await xapi.record(req, course, xapi.Verb.Disliked)
		req.flash(
			'successTitle',
			req.__('learning_removed_from_plan_title', course.title)
		)
		req.flash(
			'successMessage',
			req.__('learning_removed_from_suggestions', course.title)
		)
	} catch (err) {
		logger.error('Error recording xAPI statement', err)
		res.sendStatus(500)
	} finally {
		res.redirect(ref)
	}
}

export async function suggestionsPage(
	req: express.Request,
	res: express.Response
) {
	const user = req.user as model.User

	const learningRecord = await getLearningRecord(user)

	const [
		areaOfWork,
		otherAreasOfWork,
		department,
		interests,
	] = await Promise.all([
		suggestionsByAreaOfWork(user, learningRecord),
		suggestionsByOtherAreasOfWork(user, learningRecord),
		suggestionsByDepartment(user, learningRecord),
		suggestionsByInterest(user, learningRecord),
	])

	res.send(
		template.render('suggested', req, res, {
			areaOfWork,
			department,
			interests,
			otherAreasOfWork,
			successMessage: req.flash('successMessage')[0],
			successTitle: req.flash('successTitle')[0],
		})
	)
}

export async function getLearningRecord(
	user: model.User,
	learningRecordIn: Record<string, learnerRecord.CourseRecord> = {}
) {
	let learningRecord: Record<string, learnerRecord.CourseRecord> = {}

	if (Object.keys(learningRecordIn).length > 0) {
		learningRecord = learningRecordIn
	} else {
		const records = await learnerRecord.getRawLearningRecord(user)
		learningRecord = records.length ? hashArray(records, 'courseId') : {}
	}
	return learningRecord
}

export async function suggestionsByInterest(
	user: model.User,
	learningRecordIn: Record<string, learnerRecord.CourseRecord> = {}
) {
	const courseSuggestions: Record<string, model.Course[]> = {}

	const promises = (user.interests || []).map(async interest => {
		courseSuggestions[interest.name as any] = await getSuggestions(
			'',
			[],
			[interest.name],
			user.grade ? user.grade.code : '',
			6,
			await getLearningRecord(user, learningRecordIn),
			user
		)
	})
	await Promise.all(promises)
	return courseSuggestions
}

export async function suggestionsByAreaOfWork(
	user: model.User,
	learningRecordIn: Record<string, learnerRecord.CourseRecord> = {}
) {
	const courseSuggestions: Record<string, model.Course[]> = {}

	const promises = (user.areasOfWork || []).map(async aow => {
		courseSuggestions[aow as any] = await getSuggestions(
			'',
			[aow],
			[],
			user.grade ? user.grade.code : '',
			6,
			await getLearningRecord(user, learningRecordIn),
			user
		)
	})
	await Promise.all(promises)
	return courseSuggestions
}

export async function suggestionsByOtherAreasOfWork(
	user: model.User,
	learningRecordIn: Record<string, learnerRecord.CourseRecord> = {}
) {
	const courseSuggestions: Record<string, model.Course[]> = {}

	const promises = (user.otherAreasOfWork || []).map(async aow => {
		courseSuggestions[aow.name as any] = await getSuggestions(
			'',
			[aow.name],
			[],
			user.grade ? user.grade.code : '',
			6,
			await getLearningRecord(user, learningRecordIn),
			user
		)
	})
	await Promise.all(promises)
	return courseSuggestions
}

export async function suggestionsByDepartment(
	user: model.User,
	learningRecordIn: Record<string, learnerRecord.CourseRecord> = {}
) {
	const courseSuggestions: Record<string, model.Course[]> = {}
	if (user.department) {
		courseSuggestions[user.department as any] = await getSuggestions(
			user.department!,
			[],
			[],
			user.grade ? user.grade.code : '',
			6,
			await getLearningRecord(user, learningRecordIn),
			user
		)
	}
	return courseSuggestions
}

export async function homeSuggestions(
	user: model.User,
	learningRecord: Record<string, learnerRecord.CourseRecord> = {}
) {
	return await getSuggestions(
		user.department!,
		user.areasOfWork || [],
		[],
		user.grade ? user.grade.code : '',
		6,
		learningRecord,
		user
	)
}

async function getSuggestions(
	department: string,
	areasOfWork: string[],
	interests: string[],
	grade: string,
	count: number,
	learningRecord: Record<string, learnerRecord.CourseRecord | model.Course>,
	user: model.User
): Promise<model.Course[]> {
	const params: ApiParameters = new catalog.ApiParameters(
		areasOfWork,
		department,
		interests,
		grade,
		0,
		count
	)

	let newSuggestions: model.Course[] = []
	let hasMore = true

	while (newSuggestions.length < count && hasMore) {
		const page = await catalog.findSuggestedLearningWithParameters(
			user,
			params.serialize() as string
		)
		newSuggestions = newSuggestions.concat(
			modifyCourses(page.results, learningRecord)
		)
		hasMore = page.totalResults > page.size * (page.page + 1)
		params.page += 1
	}

	return newSuggestions.slice(0, count)
}

function modifyCourses(
	courses: model.Course[],
	learningRecord: Record<string, learnerRecord.CourseRecord | model.Course>
) {
	const modified: model.Course[] = []
	for (const course of courses) {
		if (!learningRecord[course.id]) {
			modified.push(course)
		}
	}
	return modified
}
