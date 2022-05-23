import {Spinner} from '@snickbit/node-utilities'
import {$out} from './helpers'

export let $spinner: Spinner

export function start(message: any) {
	if ($spinner) {
		$spinner.start(message)
	} else {
		$spinner = new Spinner(message)
		$spinner.start()
	}
}

export function finish(message: any) {
	if ($spinner) {
		$spinner.finish(message)
		$spinner = undefined
	} else {
		$out.success(message)
	}
}

export function fail(message: any) {
	if ($spinner) {
		$spinner.fail(message)
	} else {
		$out.error(message)
	}
}
