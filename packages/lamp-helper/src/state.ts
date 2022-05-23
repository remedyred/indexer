import {Model} from '@snickbit/model'

export interface State {
	username?: string
}

export const $state: Model = new Model()
