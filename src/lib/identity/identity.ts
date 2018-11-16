import {LineManager} from '../model'

export class Identity {
	// readonly uid: string
	// readonly roles: string[]
	// readonly accessToken: string
	//
	// constructor(uid: string, roles: string[], accessToken: string) {
	// 	this.uid = uid
	// 	this.roles = roles
	// 	this.accessToken = accessToken
	// }
	//
	// hasRole(role: string) {
	// 	return this.roles && this.roles.indexOf(role) > -1
	// }
	//
	// hasAnyRole(roles: string[]) {
	// 	return this.roles && this.roles.some(value => roles.indexOf(value) > -1)
	// }
	//
	// hasCompleteProfile() {
	// 	//	return this.department && this.areasOfWork && this.grade
	// 	return true
	// }
	static create(data: any) {
		const user = new Identity(
			data.uid || data.id,
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
		roles: string[],
		accessToken: string
	) {
		this.id = id
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
