import * as dotenv from 'dotenv'
import * as fs from 'fs'

export const ENV = process.env.NODE_ENV || 'development'
export const PRODUCTION_ENV = ENV === 'production'
export const PROFILE = process.env.ENV_PROFILE || 'local'
export const VER = process.env.npm_package_version

if (ENV === 'development') {
	const envFile = '/keybase/team/lpg/dev/dotenv'
	try {
		if (!fs.statSync(envFile).isFile()) {
			throw new Error(`File not found: ${envFile}`)
		}
		dotenv.config({path: envFile})
	} catch (err) {
		warn(`
!!! Unable to load the env file at ${envFile} !!!

`)
	}
}

function getEnv(obj: any, attr: string) {
	return process.env[attr] || ''
}

function set<T>(defaultValue: T, envValues: Record<string, T> = {}): T {
	const val = envValues[ENV]
	if (val === undefined) {
		return defaultValue
	}
	return val
}

function warn(msg: string) {
	if (process.stdout.isTTY && /-256(color)?$/i.test(process.env.TERM || '')) {
		console.log(`\u001b[33m${msg}\u001b[0m`)
	} else {
		console.log(msg)
	}
}

const env: Record<string, string> = new Proxy({}, {get: getEnv})

export const AUTHENTICATION = set({
	clientId: env.OAUTH_CLIENT_ID || '9fbd4ae2-2db3-44c7-9544-88e80255b56e',
	clientSecret: env.OAUTH_CLIENT_SECRET || 'test',
	managementId: env.OAUTH_CLIENT_ID || 'f90a4080-e5e9-4a80-ace4-f738b4c9c30e',
	managementSecret: env.OAUTH_CLIENT_SECRET || 'test',
	serviceUrl: env.AUTHENTICATION_SERVICE_URL || 'http://localhost:8080',
})

export const COOKIE = set({
	maxAge: Number(env.COOKIE_AGE_IN_MILLISECONDS) || 15768000,
})

export const BOOKING_NOTIFY_TEMPLATE_IDS = {
	cancelled: 'cc525c34-1a31-4fa1-ab19-862fd223caab',
	cancelledLineManager: 'c00fac77-8448-41c9-b15c-23361ccef419',
	requested: 'ae678ea1-ae7a-42f3-aa27-037336b346c4',
	requestedLineManager: '659f8f61-d326-428e-996d-f890b61a2f96',
}

export const BOOKING_NOTIFY_RECIPIENTS = [
	'r.vaughan@kainos.com',
	'richard@cautionyourblast.com',
]

export const CONTENT_URL =
	env.CONTENT_URL || 'http://local-cdn.cshr.digital/lpgdevcontent'

export const CONTENT_CONTAINER = env.CONTENT_CONTAINER || 'lpgdevcontent'

export const COURSE_CATALOGUE = set({
	url: env.COURSE_CATALOGUE_URL || 'http://localhost:9001',
})

export const FEEDBACK_RECIPIENTS = [
	env.FEEDBACK_RECIPIENT || 'feedback@cslearning.gov.uk',
]

export const FEEDBACK_TEMPLATE_ID = '3fca8e51-ee09-4c4d-904f-bbd00d58f28d'

export const GOOGLE_ANALYTICS_ID = env.GOOGLE_ANALYTICS_ID || 'UA-22141655-4'

export const GOOGLE_ANALYTICS_CODE = `<script>
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', '${GOOGLE_ANALYTICS_ID}', { anonymize_ip: true });
</script>`

export const GOV_NOTIFY_API_KEY =
	env.GOV_NOTIFY_API_KEY ||
	'test-22877568-4bca-40f9-8f54-8bf7922583cf-e2f80f22-e3de-4007-9ce2-b50a2b5785b7'

export const LEARNER_RECORD = set({
	url: env.LEARNER_RECORD_URL || 'http://localhost:9000',
})

export const LOGGING = set(
	{
		appenders: {
			out: {type: 'console'},
		},
		categories: {
			default: {appenders: ['out'], level: 'ERROR'},
		},
	},
	{
		development: {
			appenders: {
				out: {type: 'console'},
			},
			categories: {
				default: {appenders: ['out'], level: 'debug'},
			},
		},
	}
)

export const LPG_UI_SERVER =
	env.LPG_UI_SERVER || 'http://localhost:3001'

export const LPG_MANAGMENT_SERVER =
	env.LPG_MANAGEMENT_SERVER || 'http://localhost:3003'

export const SESSION_SECRET =
	env.SESSION_SECRET ||
	'dcOVe-ZW3ul77l23GiQSNbTJtMRio87G2yUOUAk_otcbL3uywfyLMZ9NBmDMuuOt'

export const XAPI = set({
	auth: {
		password: env.XAPI_PASS || '1c0e1b6827606d7efed71e204939d048f94f842b',
		username: env.XAPI_USER || '66f2b4fc001e3da992d23b57d8a7457655bea078',
	},
	courseBaseUri: 'http://cslearning.gov.uk/courses',
	eventBaseUri: 'http://cslearning.gov.uk/events',
	moduleBaseUri: 'http://cslearning.gov.uk/modules',
	url: env.XAPI_URL || 'http://localhost:8083/data/xAPI',
})

export const YOUTUBE_API_KEY = env.YOUTUBE_API_KEY

export const REGISTRY_SERVICE_URL =
	env.REGISTRY_SERVICE_URL || 'http://localhost:9002'

export const CHECK_LINEMANAGER_URL =
	REGISTRY_SERVICE_URL + '/civilServants/manager'

export const REPORT_SERVICE = set({
	url: env.REPORT_SERVICE_URL || 'http://localhost:9004',
})

export const LPG_MANAGEMENT_URL =
	env.LPG_MANAGEMENT_SERVER || 'http://localhost:3005'

export const REQUEST_TIMEOUT = Number(env.REQUEST_TIMEOUT) || 60000

export const INSTRUMENTATION_KEY = env.instrumentation_key || 'instrumentation_key'

export const CONTACT_EMAIL = env.CONTACT_EMAIL || 'support@civilservicelearning.uk'

export const CONTACT_NUMBER = env.CONTACT_NUMBER || '020 3640 7985'

export const REDIS = set({
	host: env.REDIS_HOST || 'localhost',
	password: env.REDIS_PASSWORD || '',
	port: +(env.REDIS_PORT || '6379'),
})
