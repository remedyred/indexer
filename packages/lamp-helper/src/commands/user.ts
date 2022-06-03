import {$state} from '../state'
import cli from '@snickbit/node-cli'
import user from '../actions/user'

export default async argv => cli(argv).args({
	username: {
		description: 'Username to create',
		type: 'string'
	}
}).run(async args => {
	$state.set(args)
	return user()
})
