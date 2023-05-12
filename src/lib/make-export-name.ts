import {GenerateConfig} from './config'
import {camelCase, safeVarName, snakeCase, spaceCase} from '@snickbit/utilities'

/**
 * Generate export name
 */
export function makeExportName(name: string, casing: GenerateConfig['casing'] = 'keep'): string {
	name = spaceCase(name)
	switch (casing) {
		case 'pascal': {
			return name.charAt(0).toUpperCase() + camelCase(name.slice(1))
		}
		case 'snake': {
			return snakeCase(name)
		}
		case 'upper': {
			return name.replace(/\s/g, '').toUpperCase()
		}
		case 'lower': {
			return name.replace(/\s/g, '').toLowerCase()
		}
		case 'keep': {
			return safeVarName(name).replace(/_/g, '')
		}
		default: { // camel case
			return camelCase(name)
		}
	}
}
