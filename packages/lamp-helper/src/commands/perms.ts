import cli from '@snickbit/node-cli'
import {$state} from '../state'
import perms from '../actions/perms'

export default async argv => cli(argv).args({
	username: {
		description: 'Username to adjust',
		type: 'string'
	},
	domain: {
		description: 'Domain to adjust',
		type: 'string'
	}
}).run(async args => {
	$state.set(args)
	return perms()
})
