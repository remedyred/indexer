import cli from '@snickbit/node-cli'
import {confirm} from '@snickbit/node-utilities'
import user from '../actions/user'
import ftp from './ftp'
import vhost from '../actions/vhost'
import {$out, required} from '../helpers'

export default async argv => cli(argv).args({
	username: {
		description: 'Username to create',
		type: 'string'
	}
}).run(async args => {
	$out.info('Creating client')

	let username = await required('Username: ', args.username as string)

	await user(username)

	if (await confirm('Enable FTP?')) {
		await ftp(username)
	}

	if (await confirm('Create virtualhost?')) {
		await vhost(username)
	}
})
