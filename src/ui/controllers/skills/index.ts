import * as express from 'express'
import * as template from 'lib/ui/template'

export async function startQuiz(req: express.Request, res: express.Response) {
	res.send(template.render('/skills', req, res, {}))
}

export async function chooseQuiz(req: express.Request, res: express.Response) {
	res.send(template.render('/skills/choose-quiz', req, res, {}))
}
