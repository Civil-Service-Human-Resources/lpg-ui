import * as express from 'express'
import {NextFunction} from "express"
import * as model from 'lib/model'
import * as skillsApi from "lib/service/skills"
import {Choice, Question} from "lib/service/skills/api"
import * as template from 'lib/ui/template'

export function introduction(req: express.Request, res: express.Response) {
	let show: boolean = false
	const user = req.user as model.User
	// @ts-ignore
	if (user.areasOfWork && user.areasOfWork.length > 0) {
		show = user.areasOfWork[1].toLocaleLowerCase() === 'policy'
	}
	res.send(template.render('skills/introduction', req, res, {show}))
}

export function chooseQuiz(req: express.Request, res: express.Response) {
	res.send(template.render('skills/choose-quiz', req, res))
}

export async function startQuiz(req: express.Request, res: express.Response, next: NextFunction) {
	const user = req.user as model.User
	// @ts-ignore
	await skillsApi.searchQuiz(user.areasOfWork[0], req.body.limit)
		.then((quiz: any) => {
			if (quiz.questionCount < 1) {
				req.session!.sessionFlash = {
					emailAddressFoundMessage: 'could_not_invite_learner',
				}
				return res.send(template.render('skills/introduction', req, res, {show: false}))
			}
			const questionLetter = ['A) ', 'B) ', 'C) ', 'D) ', 'E) ']
			quiz.questions.forEach((q: any) => {
				q.choices.forEach((c: any, i: any) => {
					q.answers.map((a: any) => {
						if (a.value === c.value) {
							a.questionLetter = questionLetter[i]
						}
					})
					c.questionLetter = questionLetter[i]
				})
			})
			req.session!.quiz = quiz
			req.session!.save(() => {
				res.redirect('/skills/questions/0')
			})
		})
		.catch((error: any) => {
			next(error)
		})
}

export async function nextQuestion(req: express.Request, res: express.Response) {
	if (!req.session!.quiz) {
		return res.redirect(`/skills`)
	}
	const index: number = parseInt(req.params.questionIndex, 0)
	if (index > req.session!.quiz.questionCount - 1) {
		res.redirect(`/skills/summary`)
	}
	const question = req.session!.quiz.questions[index]
	const count = req.session!.quiz.questionCount
	const type = getType(question.type)
	const theme = req.session!.quiz.questions[index].theme
	const why = req.session!.quiz.questions[index].why
	res.send(
		template.render('skills/questions', req, res, {index, question, count, type, theme, why})
	)
}

export async function answerQuestion(req: express.Request, res: express.Response) {
	// @ts-ignore
	let index: number = req.params.questionIndex
	if (index > req.session!.quiz.questionCount - 1) {
		res.redirect(`/skills/summary`)
	}

	req.session!.quiz.answers[index] = req.body.answers
	index++
	req.session!.save(() => {
		res.redirect(`/skills/questions/${index}`)
	})
}

export async function quizSummary(req: express.Request, res: express.Response) {
	if (!req.session!.quiz) {
		return res.redirect(`/skills`)
	}
	const quiz = req.session!.quiz
	let correct: number = 0
	quiz.questions.forEach((question: Question, index: number) => {
		const type: string = getType(question.type)
		question.choices.forEach((choice: Choice) => {
			choice.type = type
			choice.checked = quiz.answers[index] && quiz.answers[index].includes(choice.value)
		})
		question.correct = getDecision(question, quiz.answers[index])
		if (question.correct) {
			correct++
		}
		setCorrectAnswers(question, question.answers)
	})
	res.send(
		template.render('skills/quiz-summary', req, res, {correct, quiz})
	)
}

function setCorrectAnswers(question: Question, answers: Choice[]) {
	answers = sortList(answers)
	const correctAnswerString: string[] = answers.map(item => " " + item.questionLetter + item.value)
	question.correctAnswers = correctAnswerString.toString()
}

function getType(type: string) {
	return type === 'MULTIPLE' ? 'checkbox' : 'radio'
}

function getDecision(question: Question, answers: any) {
	if (!answers) {
		return false
	}
	if (question.type === 'SINGLE') {
		return answers === question.answers[0].value
	}
	if (question.answers.length !== answers.length) {
		return false
	}
	for (const choice of question.answers) {
		if (!answers.includes(choice.value) && answers !== choice.value) {
			return false
			break
		}
	}
	return true
}

function sortList(list: any) {
	return list.sort((a: any, b: any) => {
		if (a.questionLetter < b.questionLetter) { return -1 }
		if (a.questionLetter > b.questionLetter) { return 1 }
		return 0
	})
}
