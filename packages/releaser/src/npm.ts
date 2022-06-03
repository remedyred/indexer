import {useConfig} from './config'
import {npmPreferredClient as npmPreferredClientSuper} from '@remedyred/cli-utilities'

let preferred_client: string

export async function npmPreferredClient(): Promise<string> {
	if (preferred_client) {
		return preferred_client
	}
	const config = await useConfig()
	preferred_client = await npmPreferredClientSuper(config)
	return preferred_client
}
