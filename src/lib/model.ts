import * as config from 'lib/config'
import * as datetime from 'lib/datetime'
import * as learnerRecord from 'lib/learnerrecord'
import * as moment from 'moment'
import {Duration} from 'moment'

export interface LineManager {
	email: string
	name?: string
}

export class Course {
	static create(data: any, user?: User) {
		const course = new Course(data.id)
		course.description = data.description
		course.learningOutcomes = data.learningOutcomes
		course.shortDescription = data.shortDescription
		course.title = data.title
		course.status = data.status

		course.modules = (data.modules || []).map(Module.create)

		const audiences = (data.audiences || []).map(Audience.create)
		course.audiences = audiences

		if (user) {
			let matchedAudience = null
			let matchedRelevance = -1
			for (const audience of audiences) {
				const relevance = audience.getRelevance(user!)
				if (relevance > matchedRelevance) {
					matchedAudience = audience
					matchedRelevance = relevance
				}
			}
			course.audience = matchedAudience

			if (course.audience) {
				course.audience.mandatory = false
				course.audience.departments.forEach(a => {
					if (
						a === user.department &&
						course.audience!.type === 'REQUIRED_LEARNING'
					) {
						course.audience!.mandatory = true
					}
				})
			}
		}

		return course
	}

	id: string
	title: string
	shortDescription: string
	description: string
	duration: number
	learningOutcomes: string
	status: string

	modules: Module[]

	audiences: Audience[]
	audience?: Audience

	record?: learnerRecord.CourseRecord

	constructor(id: string) {
		this.id = id
	}

	isArchived() {
		return this.status ? this.status === 'Archived' : false
	}

	isComplete() {
		return this.record ? this.record!.state === 'COMPLETED' : false
	}

	isStarted() {
		return this.record ? this.record!.state === 'IN_PROGRESS' : false
	}

	hasPreference() {
		return this.record && this.record.preference
	}

	getModules() {
		return this.modules
	}

	isAssociatedLearningModule(id: number) {
		return this.modules[id].associatedLearning
	}

	getActivityId() {
		return `${config.XAPI.courseBaseUri}/${this.id}`
	}

	getAreasOfWork() {
		return this.audience ? this.audience.areasOfWork : []
	}

	getCost() {
		const costArray = this.modules.map(module => module.cost || 0)
		return costArray.length ? costArray.reduce((p, c) => p + c, 0) : null
	}

	getDuration() {
		const durationArray = this.modules.map(m => m.duration)
		return durationArray.length
			? datetime.formatCourseDuration(durationArray.reduce((p, c) => p + c, 0))
			: null
	}

	getGrades() {
		return this.audience ? this.audience.grades : []
	}

	getSelectedDate() {
		if (this.record) {
			const bookedModuleRecord = this.record.modules.find(
				m => !!m.eventId && m.state !== 'SKIPPED'
			)
			if (bookedModuleRecord) {
				const bookedModule = this.modules.find(
					m => m.id === bookedModuleRecord.moduleId
				)
				if (bookedModule) {
					const event = bookedModule.getEvent(bookedModuleRecord.eventId!)
					if (event) {
						return event.date
					}
				}
			}
		}
		return null
	}

	getType() {
		if (!this.modules.length) {
			return 'unknown'
		}
		if (this.modules.length > 1) {
			return 'blended'
		}
		return this.modules[0].type
	}

	isRequired() {
		return this.audience ? this.audience.mandatory : false
	}

	nextRequiredBy() {
		const completionDate = this.getCompletionDate()
		if (this.audience) {
			return this.audience!.nextRequiredBy(completionDate)
		}
		return null
	}

	getMandatoryCount() {
		const modules = this.getModules()
		let count = 0
		modules.forEach(module => {
			if (!module.optional) {
				count++
			}
		})

		return count
	}

	getCompletionDate() {
		if (this.isComplete()) {
			let completionDate: Date | undefined
			for (const moduleRecord of this.record!.modules) {
				if (!completionDate) {
					completionDate = moduleRecord.completionDate
				} else if (
					moduleRecord.completionDate &&
					moduleRecord.completionDate > completionDate
				) {
					completionDate = moduleRecord.completionDate
				}
			}
			return completionDate
		}
		return undefined
	}

	shouldRepeat() {
		const completionDate = this.getCompletionDate()
		if (this.audience) {
			return this.audience!.shouldRepeat(completionDate)
		}
		return false
	}
}

export class CourseModule {
	static createFromCourse(course: Course) {
		const courseModule = new CourseModule()
		courseModule.course = course
		courseModule.type = 'course'
		return courseModule
	}

	course: Course
	module: Module
	type: string
}

export class Module {
	static create(data: any) {
		const module = new Module(data.id, data.type)
		module.duration = data.duration
		module.cost = data.cost
		module.productCode = data.productCode
		module.startPage = data.startPage
		module.title = data.title
		module.description = data.description
		module.url = data.url
		module.location = data.location
		module.fileSize = data.fileSize
		module.optional = data.optional || false
		module.associatedLearning = data.associatedLearning
		module.events = (data.events || []).map(Event.create)

		return module
	}

	id: string
	type: string

	title: string
	description: string

	duration: number
	optional = false
	associatedLearning = false
	url?: string
	location?: string
	fileSize?: number
	cost?: number
	productCode?: string
	startPage?: string

	events: Event[]

	constructor(id: string, type: string) {
		this.id = id
		this.type = type
	}

	getActivityId() {
		return `${config.XAPI.moduleBaseUri}/${this.id}`
	}

	getDuration() {
		if (!this.duration) {
			return null
		}
		return datetime.formatCourseDuration(this.duration)
	}

	getEvent(eventId: string) {
		return this.events.find(event => event.id === eventId)
	}

	isAssociatedLearning() {
		return this.associatedLearning
	}
}

export class ModuleWithCourse extends Module {
	courseId?: string
	course?: Course
}
export class Event {
	static create(data: any) {
		// TODO: Matt - this is a temp work around to circumvent new event definition not matching UI
		let date: any = ''
		if (data.dateRanges[0]) {
			date = new Date(
				data.dateRanges[0].date + 'T' + data.dateRanges[0].startTime
			)
		} else {
			date = data.date
		}

		let location = ''
		let capacity = 0
		let availability = 0
		if (data.venue) {
			location = data.venue.location
			capacity = data.venue.capacity
			availability = data.venue.availability
		} else {
			location = data.location
			capacity = data.capacity
		}

		const status = data.status ? data.status : 'Active'

		return new Event(date, location, capacity, availability, status, data.id)
	}

	id: string
	date: Date
	location: string
	capacity: number
	availability: number
	status: string
	isLearnerBooked: boolean

	constructor(
		date: Date,
		location: string,
		capacity: number,
		availability: number,
		status: string,
		id?: string
	) {
		if (id) {
			this.id = id!
		}
		this.date = date
		this.location = location
		this.capacity = capacity
		this.availability = availability
		this.status = status
		this.isLearnerBooked = false
	}

	getActivityId() {
		return `${config.XAPI.eventBaseUri}/${this.id}`
	}
}

export class Audience {
	static create(data: any) {
		const audience = new Audience()
		audience.areasOfWork = data.areasOfWork || []
		audience.departments = data.departments || []
		audience.grades = data.grades || []
		audience.interests = data.interests || []
		audience.mandatory = data.mandatory === undefined ? true : data.mandatory
		audience.frequency = data.frequency ? moment.duration(data.frequency) : undefined
		audience.type = data.type ? data.type.toString() : null
		if (data.requiredBy) {
			audience.requiredBy = new Date(data.requiredBy)
		}
		return audience
	}

	areasOfWork: string[]
	departments: string[]
	grades: string[]
	interests: string[]
	mandatory = false
	requiredBy?: Date | null
	frequency?: Duration
	type: string

	get optional() {
		return !this.mandatory
	}

	set optional(value: boolean | string) {
		this.mandatory = !value || value === 'false'
	}

	getRelevance(user: User) {
		let relevance = -1

		if (
			!(
				this.areasOfWork.length ||
				this.departments.length ||
				this.grades.length
			)
		) {
			return 0
		}

		if (
			user.areasOfWork &&
			this.areasOfWork.filter(
				areaOfWork => user.areasOfWork!.indexOf(areaOfWork) > -1
			).length
		) {
			relevance += 1
		}
		if (user.department && this.departments.indexOf(user.department) > -1) {
			relevance += 1 // N.B. user.areasOfWork!.indexOf(areaOfWork) will be false for index 0 , so check for > -1
		}
		if (user.grade && this.grades.indexOf(user.grade) > -1) {
			relevance += 1
		}
		return relevance
	}

	nextRequiredBy(completionDate?: Date) {
		const [last, next] = this._getCurrentRecurrencePeriod()
		if (!last || !next) {
			return null
		}
		if (completionDate && completionDate > last) {
			if (!this.frequency) {
				return null
			}
			return Frequency.increment(this.frequency, next)
		}
		return next
	}

	shouldRepeat(completionDate?: Date) {
		const [last, next] = this._getCurrentRecurrencePeriod()
		if (!last || !next) {
			return !completionDate
		}
		if (!completionDate) {
			return true
		}
		return completionDate < last
	}

	_getCurrentRecurrencePeriod() {
		if (!this.requiredBy || !this.frequency) {
			return [null, null]
		}
		const today = new Date()
		let nextDate = this.requiredBy
		while (nextDate < today) {
			nextDate = Frequency.increment(this.frequency, nextDate)
		}
		const lastDate = Frequency.decrement(this.frequency, nextDate)
		return [lastDate, nextDate]
	}
}

export class Frequency {
	static increment(frequency: Duration, date: Date) {
		return new Date(date.getFullYear() + frequency.years(), date.getMonth() + frequency.months(), date.getDate())
	}

	static decrement(frequency: Duration, date: Date) {
		return new Date(date.getFullYear() - frequency.years(), date.getMonth() - frequency.months(), date.getDate())
	}
}

export class Feedback {
	id: string
	courseId: string
	moduleId: string
	userId: string

	comments: string
	content: number
	interactivity: number
	presentation: number
	relevance: number
}

export class OrganisationalUnit {
	code: string
	name: string
	paymentMethods: string[]
}

export class User {
	static create(data: any) {
		const user = new User(
			data.uid || data.id,
			data.userName || data.username,
			data.sessionIndex,
			Array.isArray(data.roles) ? data.roles : [data.roles],
			data.accessToken
		)

		user.organisationalUnit =
			data.organisationalUnit || new OrganisationalUnit()
		user.department = data.organisationalUnit
			? data.organisationalUnit.code
			: data.department
		user.givenName = data.fullName ? data.fullName : data.givenName
		user.grade = data.grade
		if (data.profession || data.areasOfWork) {
			user.areasOfWork = Object.values(data.profession || data.areasOfWork)
		}
		user.otherAreasOfWork = data.otherAreasOfWork
		user.interests = data.interests

		if (data.lineManagerEmailAddress) {
			user.lineManager = {
				email: data.lineManagerEmailAddress,
				name: data.lineManagerName,
			}
		} else {
			user.lineManager = data.lineManager
		}

		return user
	}

	readonly id: string
	readonly userName: string
	readonly sessionIndex: string
	readonly roles: string[]
	readonly accessToken: string

	department?: string
	areasOfWork?: string[]
	lineManager?: LineManager
	otherAreasOfWork?: any[]
	interests?: any[]
	givenName?: string
	organisationalUnit?: OrganisationalUnit

	grade?: any

	constructor(
		id: string,
		userName: string,
		sessionIndex: string,
		roles: string[],
		accessToken: string
	) {
		this.id = id
		this.userName = userName
		this.sessionIndex = sessionIndex
		this.roles = roles
		this.accessToken = accessToken
	}

	hasCompleteProfile() {
		//	return this.department && this.areasOfWork && this.grade
		return true
	}

	hasRole(role: string) {
		return this.roles && this.roles.indexOf(role) > -1
	}

	hasAnyRole(roles: string[]) {
		return this.roles && this.roles.some(value => roles.indexOf(value) > -1)
	}

	isAdmin() {
		return (
			this.hasRole('LEARNING_MANAGER') ||
			this.hasRole('CSL_AUTHOR') ||
			this.hasRole('PROFESSION_AUTHOR') ||
			this.hasRole('ORGANISATION_AUTHOR') ||
			this.hasRole('KPMG_SUPPLIER_AUTHOR') ||
			this.hasRole('KORNFERRY_SUPPLIER_AUTHOR') ||
			this.hasRole('KNOWLEDGEPOOL_SUPPLIER_AUTHOR')
		)
	}
}
