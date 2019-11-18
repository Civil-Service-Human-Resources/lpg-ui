import * as model from 'lib/model'

export enum CourseActionType {
	Add = 'Add',
	Delete = 'Delete',
}
export interface ActionToPlan {
	type: CourseActionType
	url: string
}

export interface CallToActionProps {
	accessibilityHelper: string
	actionToPlan?: ActionToPlan
	actionToRecord?: {
		move: string
		skip: string
	}
	isInLearningPlan: boolean
	message: string
	url: string
}

export function constructCourseCallToAction(
	course: model.Course,
	modifier?: string
) {
	const courseType = course.getType()
	const isRequired: boolean = course.isRequired()
	const isHome: boolean = modifier === 'home'

	const callToActionProps: CallToActionProps = {
		accessibilityHelper: ` ${course.title}`,
		isInLearningPlan: isRequired,
		message:
			courseType === 'face-to-face' ? 'action_BOOK' : 'action_NOT_STARTED',
		url:
			courseType === 'face-to-face'
				? `/book/${course.id}/${course.modules[0].id}/choose-date`
				: `/courses/${course.id}#modules`,
	}

	if (courseType === 'face-to-face' && modifier === 'search') {
		callToActionProps.url = `/courses/${course.id}`
	}

	if (course.record && course.record.state !== 'ARCHIVED') {
		const record = course.record
		callToActionProps.isInLearningPlan = (!!course.record || isRequired)

		const bookedModule = record.modules && record.modules.find(m => !!m.eventId)
		const isBooked =
			bookedModule &&
			(bookedModule.state === 'REGISTERED' || bookedModule.state === 'APPROVED')
		const isDatePassed = new Date() > course.getSelectedDate()!

		switch (courseType) {
			case 'face-to-face':
				if (isBooked) {
					if (isDatePassed) {
						callToActionProps.actionToRecord = {
							move: `/home?move=${course.id},${
								course.record.modules[0].moduleId
								},${course.record.modules[0].eventId}`,
							skip: `/home?skip=${course.id},${
								course.record.modules[0].moduleId
								},${course.record.modules[0].eventId}`,
						}
						delete callToActionProps.url
						delete callToActionProps.message
					} else {
						callToActionProps.url = `/book/${course.id}/${
							record.modules[0].moduleId
							}/${record.modules[0].eventId}/cancel`
						callToActionProps.message = `action_CANCEL`
					}
				}
				break
			case 'blended':
				let isFaceToFacePassed = false
				let isCourseModuleCompleted = true
				for (const module of course.getModules()) {
					const recordModule = record.modules.find(recModule => recModule.moduleId === module.id)
					if (recordModule) {
						if (recordModule.moduleType === 'face-to-face') {
							if (isBooked) {
								if (isDatePassed) {
									isFaceToFacePassed = true
								}
							}
						} else {
							if (recordModule.state !== "COMPLETED") {
								isCourseModuleCompleted = false
								break
							}
						}
					} else {
						isCourseModuleCompleted = false
						break
					}
				}
				if (isFaceToFacePassed && isCourseModuleCompleted) {
					callToActionProps.message = ""
					const faceToFaceModule = record.modules.find(recordModule => recordModule.moduleType === 'face-to-face')
					callToActionProps.actionToRecord = {
						move: `/home?move=${course.id},${
							// @ts-ignore
							faceToFaceModule.moduleId
							// @ts-ignore
						},${faceToFaceModule.eventId}`,
						skip: `/home?skip=${course.id},${
							// @ts-ignore
							faceToFaceModule.moduleId
							// @ts-ignore
						},${faceToFaceModule.eventId}`,
					}
				}
				break
			default:
				break
		}
		if (!isRequired && !isBooked && isHome) {
			callToActionProps.actionToPlan = {
				type: CourseActionType.Delete,
				url: `/home?delete=${course.id}`,
			}
		}
	} else {
		if (!isRequired && modifier === 'search') {
			callToActionProps.actionToPlan = {
				type: CourseActionType.Add,
				url: `/suggestions-for-you/add/${course.id}?ref=${modifier}`,
			}
		}
	}
	return callToActionProps
}
