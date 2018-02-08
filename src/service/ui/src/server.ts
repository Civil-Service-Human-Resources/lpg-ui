import * as bodyParser from 'body-parser'
import * as compression from 'compression'
import * as express from 'express'
import * as session from 'express-session'
import * as config from 'lib/config'
import * as log4js from 'log4js'
import * as lusca from 'lusca'
import * as serveStatic from 'serve-static'
import * as sessionFileStore from 'session-file-store'

import * as passport from 'lib/config/passport'
import * as i18n from 'lib/service/translation'

import * as courseController from './controllers/course'
import * as coursePlayerController from './controllers/course/player'
import * as homeController from './controllers/home'
import * as learningRecordController from './controllers/learning-record'
import * as searchController from './controllers/search'
import * as userController from './controllers/user'
import * as videoController from './controllers/video'
import * as xApiController from './controllers/xapi'
import * as basketController from './controllers/basket'

log4js.configure(config.LOGGING)

const {PORT = 3001} = process.env

const logger = log4js.getLogger('server')

const app = express()
const FileStore = sessionFileStore(session)

app.use(
	session({
		cookie: {
			maxAge: 31536000,
		},
		resave: true,
		saveUninitialized: true,
		secret: config.SESSION_SECRET,
		store: new FileStore({
			path: process.env.NOW ? `/tmp/sessions` : `.sessions`,
		}),
	})
)

app.enable('trust proxy')

app.use(lusca.xframe('SAMEORIGIN'))
app.use(lusca.xssProtection(true))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))

app.use(compression({threshold: 0}))

app.use(serveStatic('assets'))

passport.configure('lpg-ui', config.AUTHENTICATION.serviceUrl, app)
i18n.configure(app)

app.get('/', homeController.index)
app.get('/sign-in', userController.signIn)
app.get('/sign-out', userController.signOut)
app.get('/reset-password', userController.resetPassword)

app.use(passport.isAuthenticated)

app.get('/profile', userController.editProfile)
app.post('/profile', userController.tryUpdateProfile)
app.get('/profile-updated', userController.editProfileComplete)

app.get('/learning-plan', searchController.listAllCourses)

app.get(/.*Scorm\.js/, coursePlayerController.scormApi)
app.get(/.*portal_overrides\.js/, coursePlayerController.portalOverrides)
app.get(/.*close_methods\.js/, coursePlayerController.closeMethods)

app.param('courseId', courseController.loadCourse)

app.get('/courses/reset', courseController.resetCourses)
app.get('/courses/:courseId', courseController.display)
app.use('/courses/:courseId/do', coursePlayerController.play)
app.use('/courses/:courseId/xapi', xApiController.proxy)

app.get('/learning-record', learningRecordController.display)
app.get('/learning-record/:courseId', learningRecordController.courseResult)

app.get('/basket', basketController.basketPage)

app.get('/video', passport.isAuthenticated, videoController.play)

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
		res.sendStatus(500)
	}
)

app.listen(PORT, () => {
	logger.info(`listening on port ${PORT}`)
})