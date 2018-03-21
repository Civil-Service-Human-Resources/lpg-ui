import * as config from 'extension/config'
import * as helper from 'extension/helper'
import {wrappedAfterAll, wrappedBeforeAll} from 'extension/testsetup'
import {
	createUser,
	deleteUser,
	getUser,
	updateUser,
	updateUserGroups,
} from 'extension/user'
import {loginToCsl} from 'page/login'
import {editProfileInfo, selectors} from 'page/profile'
import * as puppeteer from 'puppeteer'

function genUserEmail() {
	return `test${Date.now()}@c.gov.uk`
}

const TEST_USERNAME = genUserEmail()

describe('profile page functionality', () => {
	let page: puppeteer.Page

	wrappedBeforeAll(async () => {
		const session = await helper.getSession('profile')
		page = await session.newPage()
		await page.authenticate({
			password: config.BASIC_AUTH_PASSWORD,
			username: config.BASIC_AUTH_USERNAME,
		})
		await page.goto(config.URL)
		const userId = await createUser(TEST_USERNAME, config.TEST_PASSWORD)
		await updateUser(userId, TEST_USERNAME, 'Test', 'co', 'commercial', 'G6')
		await updateUserGroups(TEST_USERNAME, userId)
		await loginToCsl(page, TEST_USERNAME, config.TEST_PASSWORD)
		await page.waitFor(selectors.signoutButton, {timeout: 10000})
		await page.goto(config.BASE_URL + '/profile')
	})

	wrappedAfterAll(async () => {
		const userInfo = await getUser(TEST_USERNAME)
		await deleteUser(userInfo.id)
		await page.close()
	})

	it('Should display a feedback link with the correct email address', async () => {
		const feedbackUrl = await helper.returnElementAttribute(
			selectors.feedbackLink,
			'href',
			page
		)
		expect(feedbackUrl).toEqual('mailto:feedback@cslearning.gov.uk')
	})

	it('Should display username field which matches email address', async () => {
		const username = await helper.getText(selectors.emailAddress, page)
		expect(username).toEqual(TEST_USERNAME)
	})

	it('Should display the first name field', async () => {
		expect(await helper.checkElementIsPresent(selectors.firstName, page)).toBe(
			true
		)
	})

	it('Should display the department field', async () => {
		expect(await helper.checkElementIsPresent(selectors.department, page)).toBe(
			true
		)
	})

	it('Should display the profession field', async () => {
		expect(await helper.checkElementIsPresent(selectors.profession, page)).toBe(
			true
		)
	})

	it('Should display the grade field', async () => {
		expect(await helper.checkElementIsPresent(selectors.grade, page)).toBe(true)
	})

	it('Should display a sign-out button with correct url', async () => {
		const signoutLink = await helper.returnElementAttribute(
			selectors.signoutButton,
			'href',
			page
		)
		expect(
			await helper.checkElementIsPresent(selectors.signoutButton, page)
		).toBe(true)
		expect(signoutLink).toEqual('/sign-out')
	})

	it('Should display the username field as readonly', async () => {
		expect(
			await helper.checkElementIsPresent(selectors.emailAddressReadOnly, page)
		).toBe(true)
	})

	it('Should be able to update users name from the profile section', async () => {
		const name = 'John'
		await editProfileInfo(
			selectors.updateProfileName,
			selectors.editNameField,
			name,
			page
		)
		const updatedName = await helper.getText(selectors.firstName, page)
		expect(updatedName).toEqual(name)
	})

	it('Should be able to update users department from the profile page', async () => {
		const dept = 'Home Office'
		await editProfileInfo(
			selectors.updateDepartment,
			selectors.editDepartmentField,
			dept,
			page
		)
		const updatedDept = await helper.getText(selectors.department, page)
		expect(updatedDept).toEqual(dept)
	})
})
