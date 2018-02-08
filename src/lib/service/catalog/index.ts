import * as fs from 'fs'
import * as parse from 'csv-parse/lib/sync'
import * as dgraph from 'dgraph-js'
import * as grpc from 'grpc'
import {Course} from '../../model/course'
import * as api from './api'

const {DGRAPH_ENDPOINT = 'localhost:9080'} = process.env

const SCHEMA = `tags: [string] @count @index(term) .
title: string @index(fulltext) .
shortDescription: string .
description: string .
learningOutcomes: string .
type: string .
uri: string @index(exact) .
duration: string .
`

const client = new dgraph.DgraphClient(
	new dgraph.DgraphClientStub(
		DGRAPH_ENDPOINT,
		grpc.credentials.createInsecure()
	)
)

export async function add(course: Course) {
	const txn = client.newTxn()
	try {
		const mu = new dgraph.Mutation()
		mu.setSetJson({
			description: course.description || '',
			duration: course.duration || '',
			learningOutcomes: course.learningOutcomes || '',
			shortDescription: course.shortDescription || '',
			tags: course.tags || [],
			title: course.title || '',
			type: course.type || '',
			uid: course.uid || null,
			uri: course.uri || '',
		})
		mu.setCommitNow(true)
		const assigned = await txn.mutate(mu)
		return assigned.getUidsMap().get('blank-0') || course.uid
	} finally {
		await txn.discard()
	}
}

export async function get(uid: string) {
	await setSchema(SCHEMA)

	const txn = client.newTxn()
	try {
		const query = `query all($id: string) {
			entries(func: uid($id)) {
				tags
				title
				type
				uid
				uri
				shortDescription
				description
				learningOutcomes
				duration
			}
		}`
		const qresp = await client.newTxn().queryWithVars(query, {$id: uid})
		const entries = getJson(qresp).entries
		return entries[0]
	} finally {
		await txn.discard()
	}
}

export async function findCourseByUri(uri: string) {
	await setSchema(SCHEMA)

	const txn = client.newTxn()
	try {
		const query = `query all($uri: string) {
			entries(func: eq(uri, $uri)) {
				tags
				title
				type
				uid
				uri
				shortDescription
				description
				learningOutcomes
				duration
			}
		}`
		const qresp = await client.newTxn().queryWithVars(query, {$uri: uri})
		const entries = getJson(qresp).entries
		return entries[0]
	} finally {
		await txn.discard()
	}
}

export async function search(
	req: api.SearchRequest
): Promise<api.SearchResponse> {
	await setSchema(SCHEMA)

	const map: Record<string, [number, number, Course]> = {}
	const results = []
	if (!req.tags || !req.tags.length) {
		return {entries: []}
	}
	for (const tag of req.tags) {
		const query = `query all($tag: string) {
			entries(func: eq(tags, $tag)) {
				tags
				title
				uid
				uri
			}
		}`
		const qresp = await client.newTxn().queryWithVars(query, {$tag: tag})
		const entries = getJson(qresp).entries
		for (const entry of entries) {
			let info = map[entry.uid]
			if (info) {
				info[0] += 1
			} else {
				info = [1, parseInt(entry.uid, 16), entry]
				map[entry.uid] = info
				results.push(info)
			}
		}
	}
	results.sort((a: [number, number, Course], b: [number, number, Course]) => {
		if (b[0] > a[0]) {
			return 1
		} else if (b[0] < a[0]) {
			return -1
		}
		if (b[1] > a[1]) {
			return 1
		} else if (b[1] < a[1]) {
			return -1
		}
		return 0
	})
	const {after, first} = req
	const resp: Course[] = []
	let count = 0
	let include = true
	if (after) {
		include = false
	}
	for (const info of results) {
		const entry = info[2]
		if (include) {
			resp.push(entry)
		} else {
			if (entry.uid === after) {
				include = true
			}
			continue
		}
		if (first) {
			count += 1
			if (count === first) {
				break
			}
		}
	}
	return {entries: resp}
}

export async function setSchema(schema: string) {
	const op = new dgraph.Operation()
	op.setSchema(schema)
	await client.alter(op)
}

export async function wipe() {
	const op = new dgraph.Operation()
	op.setDropAll(true)
	await client.alter(op)
}

function u8ToStr(arr) {
	var buf = Buffer.from(arr.buffer).toString()
	if (arr.byteLength !== arr.buffer.byteLength) {
		buf = buf.slice(arr.byteOffset, arr.byteOffset + arr.byteLength)
	}
	return buf.toString()
}

export async function listAll(
	req: api.SearchRequest
): Promise<api.SearchResponse> {
	await setSchema(SCHEMA)

	const query = `{
		entries(func: ge(count(tags), 1)) {
			tags
			title
			type
			uid
			uri
			shortDescription
			description
			learningOutcomes
			duration
		}
	}`
	const qresp = await client.newTxn().query(query)
	let results = getJson(qresp).entries

	results.sort(
		(a: [number, number, api.Entry], b: [number, number, api.Entry]) => {
			if (b[0] > a[0]) {
				return 1
			} else if (b[0] < a[0]) {
				return -1
			}
			if (b[1] > a[1]) {
				return 1
			} else if (b[1] < a[1]) {
				return -1
			}
			return 0
		}
	)

	const {after, first} = req
	const resp: Course[] = []
	let count = 0
	let include = true
	if (after) {
		include = false
	}
	for (const entry of results) {
		if (include) {
			resp.push(entry)
		} else {
			if (entry.uid === after) {
				include = true
			}
			continue
		}
		if (first) {
			count += 1
			if (count === first) {
				break
			}
		}
	}
	return {entries: resp}
}

export async function resetCourses() {
	await wipe()
	await setSchema(SCHEMA)

	const rawData = fs.readFileSync(__dirname + '/data.csv')
	const lines = parse(rawData)
	const attributes = lines.shift()

	const highestUid = Number(lines[lines.length - 1][0])
	let currentUid = 0x0

	/* tslint:disable */
	while (highestUid > currentUid) {
		currentUid = Number(await add({title: 'placeholder'}))
	}

	for (const line of lines) {
		let course = {}
		for (const i in attributes) {
			course[attributes[i]] = line[i]
		}
		await add(course)
	}
	/* tslint:enable */
}

function getJson(qresp) {
	try {
		return qresp.getJson()
	} catch (e) {
		let jsonString = u8ToStr(qresp.array[0])
		if (!jsonString.startsWith('{')) {
			jsonString = '{' + jsonString
		}
		return JSON.parse(jsonString.substring(0, jsonString.lastIndexOf('}') + 1))
	}
}