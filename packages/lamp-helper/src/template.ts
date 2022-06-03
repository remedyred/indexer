import {getFile} from '@snickbit/node-utilities'
import Handlebars from 'handlebars'
import path from 'path'

export function useTemplate(name: string) {
	return Handlebars.compile(getFile(path.join(__dirname, '..', 'templates', `${name}.hbs`)))
}

export function template(name: string, data?: any) {
	const $template = useTemplate(name)
	return $template(data || {})
}
