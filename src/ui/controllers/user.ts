import axios from 'axios'
import * as express from 'express'
import * as https from 'https'
import * as log4js from 'log4js'

import * as axiosLogger from 'lib/axiosLogger'
import * as extended from 'lib/extended'
import * as model from 'lib/model'
import * as registry from 'lib/registry'
import * as template from 'lib/ui/template'

import * as config from 'lib/config'
import * as passport from 'lib/config/passport'

export interface Profile {
	updateSuccessful: boolean
	user: model.User
	identityServerFailed?: boolean
	validFields?: boolean
	passwordConfirmedFailed?: boolean
}

export interface SignIn {
	loginFailed: boolean
	sessionDataKey: string
	authenticationServiceUrl: string
}

export enum nodes {
	'given-name' = 'fullName',
	'email-addresss' = 'emailAddress',
	'department' = 'organisationalUnit',
	'grade' = 'grade',
	'interest' = 'interests',
	'primary-area-of-work' = 'profession',
	'other-areas-of-work' = 'otherAreasOfWork',
	'line-manager' = 'lineManager',
	'password' = 'password',
}

const logger = log4js.getLogger('controllers/user')

// This super slick regex is by Andrew Clark from:
// https://stackoverflow.com/questions/6739676/regular-expression-matching-at-least-n-of-m-groups
//
// Keep it in sync with the regex on WSO2.

const validPassword = /(?!([a-zA-Z]*|[a-z\d]*|[^A-Z\d]*|[A-Z\d]*|[^a-z\d]*|[^a-zA-Z]*)$).{8,}/

// This slick super regex is from http://emailregex.com/

/* tslint:disable:max-line-length */
const validEmail = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
/* tslint:enable */

const http = axios.create({
	httpsAgent: new https.Agent({
		rejectUnauthorized: false,
	}),
})
axiosLogger.axiosRequestLogger(http, logger)
axiosLogger.axiosResponseLogger(http, logger)

function renderSignIn(
	req: express.Request,
	res: express.Response,
	props: SignIn
) {
	return template.render('account/sign-in', req, res, props)
}

async function updateUserObject(
	req: express.Request,
	updatedProfile: Record<string, string>
) {
	const newUser = model.User.create({
		...req.user,
		...updatedProfile,
	})
	await new Promise(resolve => {
		req.login(newUser, () => {
			req.session!.save(resolve)
		})
	})
}

function validateForm(req: express.Request) {
	const form = req.body
	delete form._csrf

	let validFields = true

	for (const input of Object.keys(form)) {
		if (!/\S/.test(form[input])) {
			form[input] = ''
			validFields = false
		}
	}
	if (Object.keys(form).length === 0) {
		validFields = false
	}
	return validFields
}

export function viewProfile(ireq: express.Request, res: express.Response) {
	const req = ireq as extended.CourseRequest
	if (ireq.session!.flash && ireq.session!.flash.children) {
		delete ireq.session!.flash.children
	}
	res.send(
		template.render('profile/view', req, res, {
			updateSuccessful: req.flash('profile-updated').length > 0,
			user: req.user,
			validFields: true,
		})
	)
}

export enum OptionTypes {
	Radio = 'radio',
	Checkbox = 'checkbox',
	Typeahead = 'typeahead',
	Confirm = 'confirm',
}

export interface Level {
	url: string
	name: string
}

export function haltoObject(traversonResult: any[]): {} {
	const data = traversonResult.map((x: any) => {
		const hash: Record<string, string> = {}
		hash[x.name] = x._links.self.href.replace(config.REGISTRY_SERVICE_URL, '')

		return hash
	})

	const out: Record<string, string> = {}

	for (const item of data) {
		const keys = Object.keys(item)
		out[item[keys[0]]] = keys[0]
	}
	return out
}

export function parseProfessions(
	traversonResult: any
): [Level[], string] | void {
	try {
		const parsed = traversonResult._embedded.professions.map(
			(profession: any) => {
				return {
					name: profession.name,
					url: profession._links.jobRoles.href,
				}
			}
		)
		return [parsed, traversonResult._links.self.href]
	} catch (e) {
		logger.error(e)
		return
	}
}

export function parseRoles(traversonResult: any): [Level[], string] | void {
	try {
		const parsed = traversonResult._embedded.jobRoles.map((role: any) => {
			return {
				hasChildren: role.hasChildren,
				name: role.name,
				url: role._links.self.href,
			}
		})

		return [parsed, traversonResult._links.self.href]
	} catch (e) {
		logger.error(e)
		return
	}
}

export async function newRenderAreasOfWorkPage(
	req: express.Request,
	res: express.Response
) {
	const lede = req.__('register_area_page_intro')
	// @ts-ignore
	let selectedArr = []
	let currentLevel: number = 0
	let selected: number
	let levels: Level[][] = []
	let prevLevelUrl

	if (req.query.select) {
		const arrUpdate = req.query.select.split('/')
		await patchAndUpdate(
			arrUpdate[0],
			req.query.select,
			'areas-of-work',
			req,
			res
		)
		return
	}

	if (req.params[0]) {
		/* set the 'progress' vars */
		selectedArr = req.params[0].split('/')
		currentLevel = selectedArr.length
		// @ts-ignore
		selected = selectedArr[currentLevel - 1] || 0
	}

	if (currentLevel === 0) {
		/* if the user hasn't selected anything, start from the beginning and reset 'levels' vars */
		req.session!.levels = []
		levels = []

		const parsed = parseProfessions(await registry.get('professions'))

		if (parsed) {
			levels.push(parsed[0])
			req.session!.prevLevelUrl = parsed[1]
		}
	} else {
		/* if the user has selected levels or there are req.params[0] */
		levels = req.session!.levels
		const followPath: string[] = []

		prevLevelUrl = levels[currentLevel! - 1][selected!].url
		if (levels.length === currentLevel) {
			// @ts-ignore
			if (selectedArr.length! > 1) {
				followPath.push('children')
			}
		} else {
			/* If they don't match up, start from the beginning and reconstruct the path.
			 * This may happen when they use the url to navigate to a level
			 * or go backwards
			 */

			prevLevelUrl = levels[currentLevel - 1][selected!].url
			// @ts-ignore
			// @ts-ignore
			selectedArr.forEach((selection: number, index: number) => {
				if (index > 0) {
					followPath.push('children')
				}
			})
		}

		const traversonResult = await registry.follow(prevLevelUrl, followPath)

		if (levels.length === 0) {
			/* if there are no levels saved, use parseProfessions method since the response contains 'professions' key */
			const parsed = parseProfessions(traversonResult)
			if (parsed) {
				levels.push(parsed[0])
				req.session!.prevLevelUrl = parsed[1]
			}
		} else {
			/* if there are levels saved, use parseRoles method since the response contains 'jobRoles' key */
			const parsed = parseRoles(traversonResult)

			if (parsed) {
				/* only set the results to the appropriate level*/
				// @ts-ignore
				levels[selectedArr.length] = parsed[0]
				req.session!.prevLevelUrl = parsed[1]
			}
		}
	}

	// @ts-ignore
	if (selectedArr) {
		/* Slice the array to the amount of levels the user should see and save the levels to session */
		// @ts-ignore
		levels = levels.slice(0, selectedArr.length + 1)
		req.session!.levels = levels
	}

	res.send(
		template.render('profile/edit', req, res, {
			currentLevel,
			inputName: 'areas-of-work',
			lede,
			levels,
			...res.locals,
			selected: selected!,
			// @ts-ignore
			selectedArr,
		})
	)
}

export function renderAreasOfWorkPage(
	req: express.Request,
	res: express.Response
) {
	if (req.query.select) {
		// const selectedLevel = req.query.select
		//TODO: LPFG-49,241 - send request to profile service to update profile

		res.redirect('/profile')
	}
	const lede = req.__('register_area_page_intro')
	let selectedArr
	let currentLevel
	let selected
	if (req.params[0]) {
		selected = req.params[0]
		selectedArr = req.params[0].split('/')
		currentLevel = selectedArr.length
	}

	const levelsToShow: any[] = []

	res.send(
		template.render('profile/edit', req, res, {
			currentLevel,
			inputName: 'other-areas-of-work',
			lede,
			levels: levelsToShow,
			...res.locals,
			selected,
			selectedArr,
		})
	)
}

export async function renderEditPage(
	req: express.Request,
	res: express.Response
) {
	const inputName = req.params.profileDetail
	let options: { [prop: string]: any } = {}
	let optionType: string = ''
	let value = null
	let lede
	let response: any
	switch (inputName) {
		case 'given-name':
			value = req.user.givenName
			break
		case 'primary-area-of-work':
			lede = req.__('register_area_page_intro')
			// options = haltoObject(await registry.halNode('professions'))
			if (req.session!.flash.children) {
				options = req.session!.flash.children
			} else {
				response = await registry.getWithoutHal('/professions/tree')
				options = sortList(response.data)
			}
			optionType = OptionTypes.Radio
			value = req.user.areasOfWork
			break
		case 'other-areas-of-work':
			lede = 'Select any other areas of work.'
			response = await registry.getWithoutHal('/professions/tree')
			sortList(response.data).map((x: any) => {
				options['/professions/' + x.id] = x.name
			})
			if (req.user.otherAreasOfWork) {
				value = req.user.otherAreasOfWork.map((otherAreasOfWork: { name: string }) => {
					return otherAreasOfWork.name
				})
			}

			optionType = OptionTypes.Checkbox

			break
		case 'department':
			response = await registry.getWithoutHal('/organisationalUnits/flat')
			response.data.map((x: any) => {
				options[x.href.replace(config.REGISTRY_SERVICE_URL, '')] = x.formattedName
			})
			optionType = OptionTypes.Typeahead
			value = req.user.department
			break
		case 'grade':
			lede = 'Please select your grade'
			options = haltoObject(await registry.halNode('grades'))
			optionType = OptionTypes.Radio
			value = req.user.grade ? req.user.grade.name : ''
			break
		case 'name':
			value = req.user.name
			break
		case 'interest':
			lede = 'Please select your interests'
			options = haltoObject(await registry.halNode('interests'))
			optionType = OptionTypes.Checkbox
			value = req.user.interests.map((interest: { name: string }) => {
				return interest.name
			})
			break
	}

	res.send(
		template.render('profile/edit', req, res, {
			...res.locals,
			error: req.flash('profileError')[0],
			errorEmpty: req.flash('profileErrorEmpty')[0],
			inputName,
			lede,
			optionType,
			options: Object.entries(options),
			value,
		})
	)
}

export function resetPassword(req: express.Request, res: express.Response) {
	res.send(template.render('account/reset-password', req, res))
}

export function signIn(req: express.Request, res: express.Response) {
	req.logout()
	const sessionDataKey = req.query.sessionDataKey
	const loginFailed = req.query.authFailureMsg === 'login.fail.message'

	if (req.isAuthenticated()) {
		res.redirect('/')
	} else if (!sessionDataKey) {
		res.redirect('/authenticate')
	} else {
		res.send(
			renderSignIn(req, res, {
				authenticationServiceUrl: config.AUTHENTICATION.serviceUrl,
				loginFailed,
				sessionDataKey,
			})
		)
	}
}

export async function signOut(req: express.Request, res: express.Response) {
	await passport.logout(
		config.AUTHENTICATION.serviceUrl,
		config.LPG_UI_SERVER,
		req,
		res,
		req.user.accessToken
	)
}

export async function tryUpdateProfile(
	req: express.Request,
	res: express.Response
) {
	const validFields = validateForm(req)

	if (req.body['primary-area-of-work']) {
		const areaOfWork = req.body['primary-area-of-work']

		const response: any = await registry.getWithoutHal('/professions/tree')
		const options: any = response.data
		let children: any = []

		const areaOfWorkId = areaOfWork.split("/professions/").pop()
		options.forEach((option: any) => {
			option.children.forEach((child: any) => {
				// tslint:disable-next-line
				if (child.id == areaOfWorkId && child.children) {
					children = child.children
				}
			})
			// tslint:disable-next-line
			if (option.id == areaOfWorkId && option.children) {
				children = option.children
			}
		})

		if (children.length > 0) {
			req.session!.flash = { children }
			return req.session!.save(() => {
				res.redirect('/profile/primary-area-of-work')
			})
		}
		delete req.session!.flash.children
	}

	if (!validFields) {
		req.flash('profileErrorEmpty', req.__('errors.profileErrorEmpty'))
		return req.session!.save(() => {
			res.redirect(`/profile/${req.params.profileDetail}`)
		})
	} else {
		await updateProfile(req, res)
	}
}
export async function patchAndUpdate(
	node: string,
	value: string,
	input: string,
	req: express.Request,
	res: express.Response
) {
	const call: Record<string, string> = {}
	call[node] = value
	const response =
		node !== 'lineManager'
			? await registry.patch('civilServants', call, req.user.accessToken)
			: await registry.checkLineManager(call, req.user.accessToken)

	if (node === 'lineManager' && (response as any).status !== 200) {
		const inputName = 'line-manager'
		const status = (response as any).status
		let errorMessage = null

		switch (status) {
			case 404:
				errorMessage = req.__('errors.lineManagerMissing')
				break
			case 400:
				errorMessage = req.__('errors.lineManagerIsUser')
				break
		}

		if (errorMessage) {
			req.flash('profileError', errorMessage)
			return req.session!.save(() => {
				res.redirect(`/profile/${inputName}`)
			})
		}
	} else if (response) {
		// seems like we have to get the profile again to get values
		// which seems ...not good
		const profile = await registry.profile(req.user.accessToken)
		await updateUserObject(req, profile as Record<string, string>)
		req.flash('profile-updated', 'profile-updated')
		return req.session!.save(() => {
			res.redirect('/profile')
		})
	} else {
		req.flash(
			'profileError',
			`Server error. Update failed, please try again or contact the
<a href="mailto:feedback@cslearning.gov.uk">Civil Service Learning Team</a>`
		)
		return req.session!.save(() => {
			res.redirect(`/profile/${input}`)
		})
	}
}

export async function updateProfile(
	ireq: express.Request,
	res: express.Response
) {
	const req = ireq as extended.CourseRequest

	let inputName = req.params.profileDetail
	// @ts-ignore
	let fieldValue = req.body[inputName]

	// @ts-ignore
	const node = nodes[inputName]

	let errorMessage = ''

	switch (node) {
		case 'interests':
			if (!Array.isArray(fieldValue)) {
				fieldValue = [fieldValue]
			}
			break
		case 'otherAreasOfWork':
			if (!Array.isArray(fieldValue)) {
				fieldValue = [fieldValue]
			}
			break
		case 'profession':
			if (Array.isArray(fieldValue)) {
				inputName = 'areasOfWork'
				fieldValue = fieldValue.join(',')
			}
			break
		case 'lineManager':
			if (fieldValue !== req.body.confirmLineManager) {
				errorMessage = req.__('errors.lineManagerConfirmation')
			} else if (!validEmail.exec(fieldValue)) {
				errorMessage = req.__('errors.lineManagerInvalid')
			}
			break
		case 'password':
			if (fieldValue !== req.body.confirmPassword) {
				errorMessage = req.__('errors.passwordUnmatched')
			} else if (fieldValue.length < 8) {
				errorMessage = req.__('errors.passwordLength')
			} else if (!validPassword.exec(fieldValue)) {
				errorMessage = req.__('errors.passwordNotMetReq')
			}

			break
	}

	if (errorMessage) {
		req.flash('profileError', errorMessage)
		req.session!.save(() => {
			res.redirect(`/profile/${inputName}`)
		})
		return
	}

	if (node in ['password']) {
		// do something with identity
	} else {
		await patchAndUpdate(node, fieldValue, inputName, req, res)
	}
}
function sortList(list: any) {
	return list.sort((a: any, b: any) => {
		if (a.name === "I don't know") { return 1 }
		if (b.name === "I don't know") { return -1 }
		if (a.name < b.name) { return -1 }
		if (a.name > b.name) { return 1 }
		return 0
	})
}
