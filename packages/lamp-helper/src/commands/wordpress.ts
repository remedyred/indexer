import cli from '@snickbit/node-cli'
import wordpress from '../actions/wordpress'
import {$state} from '../state'

export default async argv => cli(argv).args({
	username: {
		description: 'Username to create',
		type: 'string'
	},
	domain: {
		description: 'Domain to create',
		type: 'string'
	},
	site_name: {
		description: 'Name of the site to create',
		type: 'string'
	}
}).run(async (args) => {
	$state.set(args)
	return wordpress()
})