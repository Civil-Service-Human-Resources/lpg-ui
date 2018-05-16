import * as fs from 'fs'
import * as config from 'lib/config'
import * as log4js from 'log4js'

log4js.configure(config.LOGGING)

import * as bodyParser from 'body-parser'
import * as compression from 'compression'
import * as cors from 'cors'
import * as express from 'express'
import * as asyncHandler from 'express-async-handler'
import * as session from 'express-session'

import * as lusca from 'lusca'
import * as path from 'path'
import * as serveStatic from 'serve-static'
import * as sessionFileStore from 'session-file-store'

import * as passport from 'lib/config/passport'
import * as model from 'lib/model'
import * as i18n from 'lib/service/translation'
import * as template from 'lib/ui/template'

import * as bookingController from './controllers/booking'
import * as courseController from './controllers/course'
import * as feedbackController from './controllers/feedback'
import * as homeController from './controllers/home'
import * as learningRecordController from './controllers/learning-record'
import * as learningRecordFeedbackController from './controllers/learning-record/feedback'
import * as searchController from './controllers/search'
import * as suggestionController from './controllers/suggestion'
import * as userController from './controllers/user'
import * as xApiController from './controllers/xapi'

/* tslint:disable:no-var-requires */
const flash = require('connect-flash')
const favicon = require('serve-favicon')
/* tslint:enable */

const {PORT = 3001} = process.env

const logger = log4js.getLogger('server')

const app = express()
const FileStore = sessionFileStore(session)

app.disable('x-powered-by')
app.disable('etag')
app.enable('trust proxy')

const corsOptions = {
	allowedHeaders: ['Authorization', 'Content-Type', 'X-Experience-API-Version'],
	credentials: true,
	origin: /\.cshr\.digital$/,
}
app.options('*', cors(corsOptions))

app.use(
	log4js.connectLogger(logger, {
		format: ':method :url',
		level: 'trace',
		nolog: '\\.js|\\.css|\\.gif|\\.jpg|\\.png|\\.ico$',
	})
)

app.use(
	session({
		cookie: {
			domain: '.cshr.digital',
			httpOnly: true,
			maxAge: 31536000,
			sameSite: 'lax',
			secure: config.PRODUCTION_ENV,
		},
		name: 'lpg-ui',
		resave: true,
		saveUninitialized: true,
		secret: config.SESSION_SECRET,
		store: new FileStore({
			path: process.env.NOW ? `/tmp/sessions` : `.sessions`,
		}),
	})
)
app.use(flash())

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))

app.use(compression({threshold: 0}))

if (config.PROFILE === 'prod') {
	app.use(
		lusca({
			csp: {
				policy: {
					'child-src': 'https://youtube.com https://www.youtube.com',
					'default-src': "'self' https://youtube.com https://www.youtube.com",
					'font-src': 'data:',
					'frame-src': 'https://youtube.com https://www.youtube.com',
					'img-src': "'self' data: https://www.google-analytics.com",
					'script-src':
						"'self' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com " +
						"https://www.youtube.com https://s.ytimg.com 'unsafe-inline'",
					'style-src': "'self' 'unsafe-inline'",
				},
			},
			hsts: {maxAge: 31536000, includeSubDomains: true, preload: true},
			nosniff: true,
			referrerPolicy: 'same-origin',
			xframe: 'SAMEORIGIN',
			xssProtection: true,
		})
	)
}

app.use(
	(req: express.Request, res: express.Response, next: express.NextFunction) => {
		res.setHeader('Cache-Control', 'private, no-cache, no-store, max-age=0')
		res.setHeader('Pragma', 'no-cache')
		res.setHeader('Expires', '0')
		next()
	}
)

app.use(serveStatic('assets'))
app.use(favicon(path.join('assets', 'img', 'favicon.ico')))
passport.configure(
	config.AUTHENTICATION.clientId,
	config.AUTHENTICATION.clientSecret,
	config.AUTHENTICATION.serviceUrl,
	app
)
i18n.configure(app)

app.param('courseId', asyncHandler(courseController.loadCourse))
app.param('moduleId', asyncHandler(courseController.loadModule))
app.param('eventId', asyncHandler(courseController.loadEvent))

app.use('/courses/:courseId/:moduleId/xapi', asyncHandler(xApiController.proxy))

app.use(lusca.csrf())

app.get('/', homeController.index)
app.get('/sign-in', userController.signIn)
app.get('/sign-out', userController.signOut)
app.get('/reset-password', userController.resetPassword)

app.get('/privacy', (req, res) => {
	res.send(template.render('privacy', req, res))
})

app.get('/cookies', homeController.cookies)

app.get('/status', (req, res) => {
	let version = 'unknown'
	try {
		version = fs.readFileSync('../../VERSION.txt').toString()
	} catch (e) {
		logger.debug('No version set')
	}
	res.send({
		version,
	})
})

app.post('/feedback.record', asyncHandler(feedbackController.record))

app.use(passport.isAuthenticated)
app.use(passport.hasRole('LEARNER'))

app.get('/api/lrs.record', asyncHandler(learningRecordController.record))

app.get('/profile', userController.viewProfile)

// disabled for now
// app.get(
// 	'/profile/areas-of-work',
// 	asyncHandler(userController.newRenderAreasOfWorkPage)
// )
// app.get(
// 	'/profile/areas-of-work/*',
// 	asyncHandler(userController.newRenderAreasOfWorkPage)
// )

app.get('/profile/:profileDetail', userController.renderEditPage)

app.post(
	'/profile/:profileDetail',
	asyncHandler(userController.tryUpdateProfile)
)

app.use(
	(req: express.Request, res: express.Response, next: express.NextFunction) => {
		const user = req.user as model.User
		if (!user.hasCompleteProfile()) {
			logger.debug('Incomplete profile, redirecting user')
			res.redirect('/profile')
		} else {
			next()
		}
	}
)

app.get('/courses/:courseId', asyncHandler(courseController.display))

app.use(
	'/courses/:courseId/delete',
	asyncHandler(courseController.markCourseDeleted)
)

app.use(
	'/courses/:courseId/:moduleId',
	asyncHandler(courseController.displayModule)
)

app.get('/learning-record', asyncHandler(learningRecordController.display))
app.get(
	'/learning-record/feedback',
	asyncHandler(learningRecordFeedbackController.listItemsForFeedback)
)

app.get(
	'/learning-record/:courseId/:moduleId/feedback',
	asyncHandler(learningRecordFeedbackController.displayFeedback)
)
app.post(
	'/learning-record/:courseId/:moduleId/feedback',
	asyncHandler(learningRecordFeedbackController.submitFeedback)
)

app.get(
	'/learning-record/:courseId/:moduleId',
	asyncHandler(learningRecordController.courseResult)
)

app.get('/search', asyncHandler(searchController.search))
app.get(
	'/suggestions-for-you',
	asyncHandler(suggestionController.suggestionsPage)
)
app.get(
	'/suggestions-for-you/:expandedAow',
	asyncHandler(suggestionController.expandedSuggestionsPage)
)
app.get(
	'/suggestions-for-you/add/:courseId',
	asyncHandler(suggestionController.addToPlan)
)
app.get(
	'/suggestions-for-you/remove/:courseId',
	asyncHandler(suggestionController.removeFromSuggestions)
)

app.get('/home', asyncHandler(homeController.home))

app.get(
	'/book/:courseId/:moduleId/choose-date',
	bookingController.renderChooseDate
)

app.post(
	'/book/:courseId/:moduleId/choose-date/save',
	bookingController.saveAccessibilityOptions
)

app.post(
	'/book/:courseId/:moduleId/choose-date',
	bookingController.selectedDate
)

app.get(
	'/book/:courseId/:moduleId/:eventId',
	bookingController.renderPaymentOptions
)
app.post(
	'/book/:courseId/:moduleId/:eventId',
	bookingController.enteredPaymentDetails
)

app.get(
	'/book/:courseId/:moduleId/:eventId/confirm',
	asyncHandler(bookingController.renderConfirmPayment)
)

app.get(
	'/book/:courseId/:moduleId/:eventId/complete',
	asyncHandler(bookingController.tryCompleteBooking)
)

app.get(
	'/book/:courseId/:moduleId/:eventId/cancel',
	asyncHandler(bookingController.renderCancelBookingPage)
)
app.post(
	'/book/:courseId/:moduleId/:eventId/cancel',
	asyncHandler(bookingController.tryCancelBooking)
)
app.get(
	'/book/:courseId/:moduleId/:eventId/cancelled',
	asyncHandler(bookingController.renderCancelledBookingPage)
)

app.use(
	(
		err: Error,
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		logger.error(
			'Error handling request for',
			req.method,
			req.url,
			req.body,
			'\n',
			err.stack
		)
		res.status(500)
		if (req.accepts('html')) {
			res.sendFile(path.join(process.cwd(), 'page/error/500.html'))
		} else if (req.accepts('json')) {
			res.send({error: err.message})
		} else {
			res.type('txt').send(`Internal error: ${err.message}`)
		}
	}
)

app.listen(PORT, () => {
	logger.info(`listening on port ${PORT}`)
})
