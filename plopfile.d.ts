import {ActionConfig as PlopActionConfig, NodePlopAPI} from 'plop'

export interface PlopAnswers {
	name: string
	typescript: boolean
	type: string
	destination: string
	git: boolean
	directory: string
	ext: 'js' | 'ts'
}

export type Plop = NodePlopAPI

export type ActionConfig = PlopActionConfig
