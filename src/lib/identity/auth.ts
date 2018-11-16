/* tslint:disable */
import * as log4js from 'log4js'
import * as oauth2 from 'passport-oauth2'
import {AuthConfig} from './authConfig'
import {Identity} from './identity'
import {IdentityService} from './identityService'
import {Handler, NextFunction, Request, Response} from 'express'
import {PassportStatic} from 'passport'

const logger = log4js.getLogger('config/passport')

export class Auth {
	readonly REDIRECT_COOKIE_NAME: string = 'redirectTo'

	config: AuthConfig
	passportStatic: PassportStatic
	identityService: IdentityService
	currentUser: Identity

	constructor(config: AuthConfig, passportStatic: PassportStatic, identityService: IdentityService) {
		this.config = config
		this.passportStatic = passportStatic
		this.identityService = identityService
	}

	configure(app: any, authorisedRole: string) {
		app.use(this.initialize())
		app.use(this.session())

		this.configureStrategy()

		app.all(this.config.authenticationPath, this.authenticate(), this.redirect())

		app.use(this.checkAuthenticatedAndAssignCurrentUser())
		app.use(this.addToResponseLocals())
		app.use(this.hasRole(authorisedRole))
	}

	initialize(): Handler {
		return this.passportStatic.initialize()
	}

	session(): Handler {
		return this.passportStatic.session()
	}

	configureStrategy() {
		let strategy: oauth2.Strategy
		strategy = new oauth2.Strategy(
			{
				authorizationURL: `${this.config.authenticationServiceUrl}/oauth/authorize`,
				callbackURL: `${this.config.callbackUrl}/authenticate`,
				clientID: this.config.clientId,
				clientSecret: this.config.clientSecret,
				tokenURL: `${this.config.authenticationServiceUrl}/oauth/token`,
			},
			this.verify()
		)
		this.passportStatic.use(strategy)

		this.passportStatic.serializeUser((user: any, done: any) => {
			done(null, JSON.stringify(user))
		})

		this.passportStatic.deserializeUser<Identity, string>(this.deserializeUser())
	}

	verify() {
		return async (accessToken: string, refreshToken: string, profile: any, cb: oauth2.VerifyCallback) => {
			try {
				const identityDetails = await this.identityService.getDetails(accessToken)

				cb(null, identityDetails)
			} catch (e) {
				logger.warn(`Error retrieving user profile information`, e)
				cb(e)
			}
		}
	}

	checkAuthenticatedAndAssignCurrentUser() {
		return (req: Request, res: Response, next: NextFunction) => {
			if (req.isAuthenticated()) {
				this.currentUser = req.user as Identity
				return next()
			}

			res.cookie(this.REDIRECT_COOKIE_NAME, req.originalUrl)
			res.redirect(this.config.authenticationPath)
		}
	}

	authenticate() {
		return this.passportStatic.authenticate('oauth2', {
			failureFlash: true,
			failureRedirect: '/',
		})
	}

	redirect() {
		// return (req: Request, res: Response) => {
		// 	const redirect = req.cookies[this.REDIRECT_COOKIE_NAME]
		// 	if (!redirect) {
		// 		logger.info('Passport session not present on express request - redirecting to root')
		// 		res.redirect('/')
		// 		return
		// 	}
		// 	delete req.cookies[this.REDIRECT_COOKIE_NAME]
		// 	res.redirect(redirect)
		// }

		return (req: Request, res: Response) => {
			const session = req.session
			if (!session) {
				console.log('passport: session not present on express request')
				res.sendStatus(500)
				return
			}
			let {redirectTo} = session
			if (!redirectTo) {
				redirectTo = '/'
			}
			delete session.redirectTo
			session.save(() => {
				res.redirect(redirectTo)
			})
		}
	}

	deserializeUser() {
		return async (data: string, done: any) => {
			let jsonResponse = JSON.parse(data)
			done(null, new Identity(jsonResponse.uid, jsonResponse.roles, jsonResponse.accessToken))
		}
	}

	addToResponseLocals() {
		return (req: Request, res: Response, next: NextFunction) => {
			res.locals.isAuthenticated = req.isAuthenticated()
			res.locals.identity = req.user
			next()
		}
	}

	hasRole(role: string) {
		return (req: Request, res: Response, next: NextFunction) => {
			if (req.user && req.user.hasRole(role)) {
				return next()
			}
			res.sendStatus(401)
		}
	}
}
