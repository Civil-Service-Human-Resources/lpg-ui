import axios from 'axios'
import * as express from 'express'
import * as config from 'lib/config'
import * as extended from 'lib/extended'
import * as xapi from 'lib/xapi'
import * as log4js from 'log4js'
import * as querystring from 'querystring'

const logger = log4js.getLogger('controllers/xapi')

export async function proxy(ireq: express.Request, res: express.Response) {
	let req = ireq as extended.CourseRequest
	logger.info(`Proxying xAPI request to ${req.path}`)
	logger.info(`Request query ${JSON.stringify(req.query)}`)

	if (req.query.method) {
		// This indicates a request has been converted to a POST. The request body will contain headers and parameter
		// required for actually completing the request.
		// Not sure why, but someone thought this was a good idea at some point.
		req = await unwrapPost(req)
	}

	const agent = {
		account: {
			homePage: xapi.HomePage,
			name: req.user.id,
		},
		name: req.user.givenName,
		objectType: 'Agent',
	}

	const query = req.query
	if (query) {
		if (query.agent) {
			query.agent = JSON.stringify(agent)
		}
		if (query.activityId) {
			query.activityId = `${config.XAPI.moduleBaseUri}/${req.module!.id}`
		}
	}

	let body = req.body
	if (body) {
		if (Array.isArray(body)) {
			logger.info(`[ARRAY] Proxy body is: ${body.toString()}`)
			body = body.map(statement => updateStatement(statement, agent, req))
		} else if (typeof body === 'object') {
			logger.info(`[OBJ] Proxy body is: ${JSON.stringify(body)}`)
			body = updateStatement(body, agent, req)
		} else {
			logger.info(`[BUFFER] Proxy body is: ${body}`)
			body = new Buffer(body)
		}
	}

	const headers: Record<string, string> = {
		'X-Experience-API-Version':
			req.header('X-Experience-API-Version') || '1.0.3',
	}

	const ctype = req.header('Content-Type')
	if (ctype) {
		headers['Content-Type'] = ctype
	}

	try {
		const response = await axios({
			auth: config.XAPI.auth,
			data: body,
			headers,
			method: req.method,
			params: query,
			responseType: 'stream',
			url: `${config.XAPI.url}${req.path}`,
		})
		response.data.pipe(res)
	} catch (e) {
		logger.warn('Error proxying xapi request', e)
		if (e.response) {
			res.sendStatus(e.response.status)
		} else {
			res.sendStatus(500)
		}
	}
}

async function unwrapPost(req: extended.CourseRequest) {
	req.method = req.query.method
	const data =  querystring.parse(req.body)

	req.headers = {
		'Content-Type': data['Content-Type'],
		'X-Experience-API-Version': data['X-Experience-API-Version'],
	}

	req.body = data.content ? JSON.parse(data.content as string) : null

	delete data.Authorization
	delete data.content
	delete data['Content-Type']
	delete data['X-Experience-API-Version']

	req.query = data

	return req
}

function updateStatement(statement: any, agent: any, req: extended.CourseRequest) {
	if (statement.actor) {
		statement.actor = agent
	}
	if (
		statement.object &&
		statement.object.objectType === 'Activity'
	) {
		statement.object.id = `${config.XAPI.moduleBaseUri}/${req.module!.id}`
		if (statement.object.definition) {
			statement.object.definition.type = xapi.Type.ELearning
		}
	}
	if (
		statement.context &&
		statement.context.contextActivities
	) {
		statement.context.contextActivities.parent = [
			{
				id: `${config.XAPI.courseBaseUri}/${req.course.id}`,
			},
		]
	} else {
		statement.context = {
			contextActivities: {
				parent: [
					{
						id: `${config.XAPI.courseBaseUri}/${req.course.id}`,
					},
				],
			},
		}
	}
	return statement
}
