import cli from '@snickbit/node-cli'
import {confirm} from '@snickbit/node-utilities'
import user from '../actions/user'
import ftp from './ftp'
import vhost from '../actions/vhost'
import {$out, $state, required} from '../helpers'
import wordpress from '../actions/wordpress'
import landing from '../actions/landing'

export default async argv => cli(argv).args({
	username: {
		description: 'Username to create',
		type: 'string'
	}
}).run(async args => {
	$state.patch(args)
	$out.info('Creating client')

	await required('username')
	await user()

	if (await confirm('Enable FTP?')) {
		await ftp()
	}

	if (await confirm('Create virtualhost?')) {
		await vhost()
	}
})
