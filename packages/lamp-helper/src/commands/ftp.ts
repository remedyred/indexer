import cli from '@snickbit/node-cli'
import ftp from '../actions/ftp'
import {$state} from '../helpers'

export default async argv => cli(argv).args({
	username: {
		description: 'Username to create',
		type: 'string'
	}
}).run(async args => {
	$state.set(args)
	return ftp()
})
