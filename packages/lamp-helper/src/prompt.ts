import {ask as askBase, confirm as confirmBase, Question} from '@snickbit/node-utilities'
import {isEmpty} from '@snickbit/utilities'
import {$state} from './state'
import {$spinner} from './spinner'
import upwords from '@snickbit/upwords'

export async function required(key: string, options?: Partial<Question>): Promise<string> {
	let answer = $state.get(key)
	while (isEmpty(answer)) {
		answer = await ask(upwords(key.split('.').join(' ')), options)
	}
	$state.set(key, answer)

	return answer
}

export async function ask(message: string, options?: Partial<Question>): Promise<string> {
	if ($spinner) {
		$spinner.stop()
	}
	const answer = await askBase(message, options)
	if ($spinner) {
		$spinner.start()
	}
	return answer
}

export async function confirm(message: string, options?: Partial<Question>): Promise<boolean> {
	if ($spinner) {
		$spinner.stop()
	}
	const answer = await confirmBase(message, options)
	if ($spinner) {
		$spinner.start()
	}
	return answer
}
