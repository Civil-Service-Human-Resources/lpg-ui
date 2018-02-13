import * as express from 'express'
import * as model from './model'

export interface CourseRequest extends express.Request {
	course: model.Course
}