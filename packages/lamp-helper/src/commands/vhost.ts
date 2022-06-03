import {$state} from '../state'
import cli from '@snickbit/node-cli'
import vhost from '../actions/vhost'

export default async argv => cli(argv).args({
	username: {
		description: 'Username to create',
		type: 'string'
	},
	domain: {
		description: 'Domain to create',
		type: 'string'
	}
}).run(async args => {
	$state.set(args)
	return vhost()
})
