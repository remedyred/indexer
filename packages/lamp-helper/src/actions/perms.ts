import {$out} from '../helpers'
import {required} from '../prompt'
import {run} from '../run'
import {fileExists, progress} from '@snickbit/node-utilities'
import {Queue} from '@snickbit/queue'
import {$state} from '../state'
import {Options as OptionsInternal} from 'fast-glob/out/settings'
import fg from 'fast-glob'

const globOptions = {
	onlyDirectories: true,
	ignore: [
		'webalizer',
		'tmp',
		'logs',
		'temp'
	]
}

export default async function() {
	const username = await required('username')

	$out.info('Starting Permissions fix')

	const user_dir = `/home/${username}`

	const domains = $state.has('domain') ? [$state.get('domain')] : await fg(`${user_dir}/*`, globOptions)

	const $queue = new Queue()

	$queue.finallyEach(() => {
		if (total) {
			$progress.tick()
		}
	})

	const $progress = progress({autoStart: false, message: 'Fixing permissions'})

	let total = 0

	const modMany = async (filePath: string, permissions: number | string, onlyDirectories = true) => {
		const options = {} as OptionsInternal
		if (onlyDirectories) {
			options.onlyDirectories = true
		} else {
			options.onlyFiles = true
		}
		const files = await fg(`${filePath}/**`, options)

		// fg won't include the root directory, but we want it
		if (onlyDirectories) {
			files.push(filePath)
		}

		total += files.length
		$progress.setTotal(total)
		$queue.push(...files.map(file => run('chmod', String(permissions), file)))
	}

	for (const domain of domains) {
		const domain_dir = `${user_dir}/www/${domain}`

		const is_wp = fileExists(`${domain_dir}/wp-content`)

		total = 2
		$progress.start({message: `Fixing permissions for ${domain}`, total})

		// Ensure .htaccess exists
		await run('touch', `${domain_dir}/.htaccess`)
		$progress.tick()

		// Set user as owner
		await run('chown', '-R', `${username}:${username}`, domain_dir)
		$progress.tick()

		// Set all files to 644
		await run('chmod', '-R', `644`, domain_dir)
		$progress.tick()

		// Set all directories to 755
		await modMany(domain_dir, '755')

		await $queue.run()
		$progress.finish(`Fixed permissions for ${domain}`)

		if (is_wp) {
			total = 1
			$progress.start({message: `Applying WordPress permissions for ${domain}`, total})

			// allow WordPress to manage wp-config.php
			await run('chmod', '-R', '660', `${domain_dir}/wp-config.php`)
			$progress.tick()

			// allow WordPress to manage wp-content

			// set wp-content files to 664
			await run('chmod', '-R', `664`, `${domain_dir}/wp-content`)
			$progress.tick()

			// set wp-content directories to 775
			await modMany(`${domain_dir}/wp-content`, '775')

			await $queue.run()
			$progress.finish(`Applied WordPress permissions for ${domain}`)
		}
	}

	$out.success('Permissions fixed')
}
