import Conf from 'conf'
import upwords from '@snickbit/upwords'
import {ask} from '@snickbit/node-utilities'

const $config = new Conf()


export async function useConfig() {
	return $config
}


export async function config(key: string) {
	while (!$config.has(key)) {
		$config.set(key, await ask(upwords(key.split('.').join(' ')) + ': '))
	}

	return $config.get(key)
}

