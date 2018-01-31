export interface Entry {
	tags?: string[]
	title?: string
	uid?: string
	uri?: string
	shortDescription?: string
}

export interface SearchRequest {
	tags?: string[]
	first?: number
	after?: string
}

export interface SearchResponse {
	entries: Entry[]
}