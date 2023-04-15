import {GenerateConfig} from './config'
import {camelCase, safeVarName, snakeCase} from '@snickbit/utilities'

/**
 * Generate export name
 */
export function makeExportName(name: string, casing: GenerateConfig['casing'] = 'keep'): string {
	switch (casing) {
		case 'camel': {
			return camelCase(name)
		}
		case 'pascal': {
			return name.charAt(0).toUpperCase() + camelCase(name.slice(1))
		}
		case 'snake': {
			return snakeCase(name)
		}
		case 'upper': {
			return name.toUpperCase()
		}
		case 'lower': {
			return name.toLowerCase()
		}
		default: { // case keep
			return safeVarName(name).replace(/_/g, '')
		}
	}
}
