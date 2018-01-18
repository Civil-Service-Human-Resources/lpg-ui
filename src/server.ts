import * as bodyParser from 'body-parser'
import * as compression from 'compression'
import * as config from 'config'
import * as express from 'express'
import * as session from 'express-session'
import * as lusca from 'lusca'
import * as passport from 'passport'
import * as serveStatic from 'serve-static'
import * as sessionFileStore from 'session-file-store'
import 'svelte/ssr/register'

const {PORT = 3001} = process.env

const app = express()
const FileStore = sessionFileStore(session)

app.use(passport.initialize())
app.use(passport.session())

app.use(
	session({
		cookie: {
			maxAge: 31536000,
		},
		resave: true,
		saveUninitialized: true,
		secret: config.get('session.secret'),
		store: new FileStore({
			path: process.env.NOW ? `/tmp/sessions` : `.sessions`,
		}),
	})
)

//app.use(lusca.csrf());
app.use(lusca.xframe('SAMEORIGIN'))
app.use(lusca.xssProtection(true))

app.use((err, req, res, next) => {
	console.log(
		'Error handling request for',
		req.method,
		req.url,
		req.body,
		'\n',
		err.stack
	)
	res.sendStatus(500)
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))

app.use(compression({threshold: 0}))

app.use(serveStatic('assets'))

const SamlStrategy = require('passport-saml').Strategy

function displaySignin(req, res) {
	const sessionDataKey = req.query.sessionDataKey

	if (req.user) {
		res.redirect('/')
	} else if (!sessionDataKey) {
		res.redirect('/authenticate')
	} else {
		res.redirect('/sign-in')
	}
}

function doSignOut(req, res) {
	console.log('Signing user out')
	req.session.destroy(() => {
		res.redirect('/')
	})
}

function isAuthenticated(req, res, next) {
	if (!req.user) {
		_forbidden(req, res)
	} else {
		next()
	}
}

function _forbidden(req, res) {
	if (!req.accepts('html')) {
		res.sendStatus(403)
	} else {
		req.session.originalRequestUrl = req.url
		res.redirect('/sign-in')
	}
}

app.get('/sign-in', (req, res) => {
	const sessionDataKey = req.query.sessionDataKey
	const loginFailed = req.query.authFailureMsg === 'login.fail.message'
	const login = require('../page/sign-in/index.html')
	const html = login.render({
		sessionDataKey,
		loginFailed,
	}).html

	res.send(html)
})

function configurePassport() {
	passport.use(
		new SamlStrategy(
			{
				acceptedClockSkewMs: -1,
				entryPoint: 'https://localhost:9443/samlsso',
				issuer: 'lpg-ui',
				path: '/authenticate',
			},
			(profile, done) => {
				done(null, {
					department: profile['http://wso2.org/claims/department'],
					emailAddress: profile.nameID,
					grade: profile['http://wso2.org/claims/grade'],
					profession: profile['http://wso2.org/claims/profession'],
				})
			}
		)
	)

	passport.serializeUser((user, done) => {
		console.log(user)
		done(null, JSON.stringify(user))
	})

	passport.deserializeUser((data, done) => {
		done(null, JSON.parse(data))
	})
}

app.all(
	'/authenticate',
	passport.authenticate('saml', {failureRedirect: '/', failureFlash: true}),
	(req, res) => {
		console.log(req.user)
		res.redirect('/')
	}
)

configurePassport()

app.get('/', (req, res) => {
	const home = require('../page/index.html')
	const html = home.render().html

	res.send(html)
})

app.get('/login', displaySignin)

app.get('/logout', doSignOut)

app.use((req, res, next) => {
	// add helper functions
	res.locals.isAuthenticated = () => !!req.user
	res.locals.hasAnyRole = roles =>
		!!req.user && roles.indexOf(req.user.role) > -1
	res.locals.today = new Date()
	res.locals.signedInUser = req.user
	next()
})

app.listen(PORT, () => {
	console.log(`listening on port ${PORT}`)
})
