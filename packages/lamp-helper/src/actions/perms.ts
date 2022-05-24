import {$out} from '../helpers'
import {finish, start} from '../spinner'
import {required} from '../prompt'
import {run} from '../run'
import {fileExists} from '@snickbit/node-utilities'
import fg from 'fast-glob'
import {$state} from '../state'

const globOptions = {
	onlyDirectories: true,
	ignore: [
		'webalizer',
		'tmp',
		'logs',
		'temp'
	]
}

export default async function () {
	const username = await required('username')

	$out.info('Starting Permissions fix')

	const user_dir = `/home/${username}`

	const domains = $state.has('domain') ? [$state.get('domain')] : await fg(`${user_dir}/*`, globOptions)

	for (const domain of domains) {
		const domain_dir = `${user_dir}/www/${domain}`

		start('Fixing permissions for ' + domain)

		const processes = []

		// set user as owner
		processes.push(run('chown', '-R', `${username}:${username}`, domain_dir))

		// Set all files to 644
		processes.push(run('chmod', '-R', '644', `${domain_dir}`))

		// Set all directories to 755
		processes.push(run('chmod', '-R', '755', `${domain_dir}`))

		if (fileExists(`${domain_dir}/wp-content`)) {
			// Apply WordPress permissions

			// Finish these processes before continuing
			await Promise.all(processes)

			// Set wp-content to 775
			processes.push(run('chmod', '-R', '775', `${domain_dir}/wp-content`))

			// Set wp-config to 660
			processes.push(run('chmod', '-R', '660', `${domain_dir}/wp-config.php`))
		}

		await Promise.all(processes)
		finish('Fixed permissions for ' + domain)
	}
}
