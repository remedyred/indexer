import {$state} from '../state'
import {$out} from '../helpers'
import {confirm} from '../prompt'
import cli from '@snickbit/node-cli'
import user from '../actions/user'
import ftp from '../actions/ftp'
import vhost from '../actions/vhost'
import wordpress from '../actions/wordpress'
import landing from '../actions/landing'

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
}).run(async args => {
	$state.set(args)
	$out.info('Creating client')

	await user()

	if (await confirm('Enable FTP?')) {
		await ftp()
	}

	if (await confirm('Create virtualhost?')) {
		await vhost()
	}

	if (await confirm('Install WordPress for this domain?')) {
		await wordpress()
	} else if (await confirm('Install landing page for this domain?')) {
		await landing()
	}
})
