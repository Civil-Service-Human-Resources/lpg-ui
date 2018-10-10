import * as config from 'lib/config'
import * as datetime from 'lib/datetime'
import * as learnerRecord from 'lib/learnerrecord'

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

		course.modules = (data.modules || []).map((module: any) => Module.create(module, user))

		return course
	}

	id: string
	title: string
	shortDescription: string
	description: string
	duration: number
	learningOutcomes: string
	price: number | string = this.collatePrice() || 'Free'

	modules: Module[]

	record?: learnerRecord.CourseRecord

	constructor(id: string) {
		this.id = id
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
		const modules = []
		for (const module of this.modules) {
			if (module.audience !== null) {
				modules.push(module)
			}
		}
		return modules
	}

	getActivityId() {
		return `${config.XAPI.courseBaseUri}/${this.id}`
	}

	getAreasOfWork() {
		return this.modules
			.map(module => module.audiences)
			.reduce((p, c) => p.concat(c), [])
			.map(audience => audience.areasOfWork)
			.reduce((p, c) => p.concat(c), [])
			.filter((v, i, a) => a.indexOf(v) === i)
	}

	getCost() {
		const costArray = this.modules.map(module => module.price)
		return costArray.length
			? costArray.reduce((p, c) => (p || 0) + (c || 0), 0)
			: null
	}

	getDuration() {
		const durationArray = this.modules.map(m => m.duration)
		return durationArray.length
			? datetime.formatCourseDuration(durationArray.reduce((p, c) => p + c, 0))
			: null
	}

	getGrades() {
		return this.modules
			.map(module => module.audiences)
			.reduce((p, c) => p.concat(c), [])
			.map(audience => audience.grades)
			.reduce((p, c) => p.concat(c), [])
			.filter((v, i, a) => a.indexOf(v) === i)
	}

	getSelectedDate() {
		if (this.record) {
			const bookedModuleRecord = this.record.modules.find(m => !!m.eventId && m.state !== 'SKIPPED')
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
		return this.modules.find(module => module.isRequired()) != null
	}

	nextRequiredBy() {
		let next = null
		const completionDate = this.getCompletionDate()
		for (const module of this.modules) {
			const moduleNext = module.nextRequiredBy(completionDate)
			if (!next) {
				next = moduleNext
			} else if (moduleNext && moduleNext.getTime() < next.getTime()) {
				next = moduleNext
			}
		}
		return next
	}

	getMandatoryCount() {
		const modules = this.getModules()
		let count = 0
		modules.forEach(module => {
			if (module.audience && module.audience!.mandatory) {
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
		for (const module of this.modules) {
			const moduleShouldRepeat = module.shouldRepeat(completionDate)
			if (moduleShouldRepeat) {
				return true
			}
		}
		return false
	}

	private collatePrice() {
		let price = 0
		if (this.modules) {
			this.modules.forEach(module => {
				if (module.price) {
					price += module.price
				}
			})
		}
		return price
	}
}
export class Resource {
	static create(data: any) {
		const resource = new Resource(data.id)
		resource.courseId = data.courseId
		resource.description = data.description
		resource.learningOutcomes = data.learningOutcomes
		resource.shortDescription = data.shortDescription
		resource.title = data.title
		resource.type = data.type

		resource.modules = (data.modules || []).map(Module.create)
		resource.course = (data.course || {}).map(Course.create)

		return resource
	}

	id: string
	courseId: string
	course: Course
	title: string
	type: string
	shortDescription: string
	description: string
	learningOutcomes: string
	modules: Module[]

	constructor(id: string) {
		this.id = id
	}
}

export class CourseModule {
	static createFromCourse(course: Course) {
		const courseModule = new CourseModule()
		courseModule.course = course
		courseModule.type = 'course'
		return courseModule
	}

	static createFromModule(module: Module, course: Course) {
		const courseModule = new CourseModule()
		courseModule.module = module
		courseModule.type = 'module'
		courseModule.course = Course.create(course)
		return courseModule
	}

	course: Course
	module: Module
	type: string
}

export class Module {
	static create(data: any, user?: User) {
		const module = new Module(data.id, data.type)
		module.duration = data.duration
		module.price = data.price
		module.productCode = data.productCode
		module.location = data.location
		module.startPage = data.startPage
		module.title = data.title
		module.description = data.description
		module.url = data.url
		module.fileSize = data.fileSize
		module.events = (data.events || []).map(Event.create)

		const audiences = (data.audiences || []).map(Audience.create)
		module.audiences = audiences

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
			module.audience = matchedAudience
		}

		return module
	}

	id: string
	type: string

	title: string
	description: string

	duration: number
	url?: string
	fileSize?: number
	location?: string
	price?: number
	productCode?: string
	startPage?: string

	audiences: Audience[]
	audience?: Audience

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

	isRequired() {
		if (this.audience) {
			return this.audience!.mandatory
		}
		return false
	}

	nextRequiredBy(completionDate?: Date) {
		if (this.audience) {
			return this.audience!.nextRequiredBy(completionDate)
		}
		return null
	}

	shouldRepeat(completionDate?: Date) {
		if (this.audience) {
			return this.audience!.shouldRepeat(completionDate)
		}
		return false
	}
}

export class ModuleWithCourse extends Module {
	courseId?: string
	course?: Course
}
export class Event {
	static create(data: any) {
		//const date = data.date ? new Date(data.date) : new Date()
        const date = data.dateRanges[0] ? new Date(data.dateRanges[0].date) : new Date()
        const venue = data.venue ? data.venue.location : data.location
		return new Event(date, venue, data.capacity, data.id)
	}

	id: string
	date: Date
	location: string
	capacity: number

	constructor(date: Date, location: string, capacity: number, id?: string) {
		if (id) {
			this.id = id!
		}
		this.date = date
		this.location = location
		this.capacity = capacity
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
		audience.frequency = data.frequency
		if (data.requiredBy) {
			audience.requiredBy = new Date(data.requiredBy)
		}
		return audience
	}

	areasOfWork: string[]
	departments: string[]
	grades: string[]
	interests: string[]
	mandatory = true

	requiredBy?: Date | null
	frequency?: string

	get optional() {
		return !this.mandatory
	}

	set optional(value: (boolean | string)) {
		this.mandatory = (!value || value === 'false')
	}

	getRelevance(user: User) {
		let relevance = -1

		if (!(this.areasOfWork.length || this.departments.length || this.grades.length)) {
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
	static FiveYearly: 'FIVE_YEARLY'
	static ThreeYearly: 'THREE_YEARLY'
	static Yearly: 'YEARLY'

	static increment(frequency: string, date: Date) {
		const step = this.getStep(frequency)
		return new Date(date.getFullYear() + step, date.getMonth(), date.getDate())
	}

	static decrement(frequency: string, date: Date) {
		const step = this.getStep(frequency)
		return new Date(date.getFullYear() - step, date.getMonth(), date.getDate())
	}

	private static getStep(frequency: string) {
		switch (frequency) {
			case Frequency.FiveYearly:
				return 5
			case Frequency.ThreeYearly:
				return 3
			default:
				return 1
		}
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

export class User {
	static create(data: any) {
		const user = new User(
			data.uid || data.id,
			data.userName || data.username,
			data.sessionIndex,
			Array.isArray(data.roles) ? data.roles : [data.roles],
			data.accessToken
		)

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

	grade?: string

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
}
