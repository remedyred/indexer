import {getFile, mkdir} from '@snickbit/node-utilities'
import {$out, hash} from '../helpers'
import {finish, start} from '../spinner'
import {confirm, required} from '../prompt'
import {run} from '../run'

export default async function() {
	const username = await required('username')
	const www_user = 'www-data'

	$out.info('Starting user creation')

	const passwd = getFile('/etc/passwd')
	if (!new RegExp(`^${username}`, 'm').test(passwd) || await confirm(`User ${username} already exists! Overwrite the old password?`)) {
		start('Creating user and setting password')
		await run(
			'useradd', '-s', '/bin/false', '-M', '-p', await hash(username), username
		)
		finish('Created user and set password')
	}

	start(`Adding ${www_user} user's group`)
	await run('usermod', '-a', '-G', username, www_user)
	finish(`Added ${www_user} user's group`)

	let user_dir = `/home/${username}`

	start('Creating home directory file structure')
	mkdir(`${user_dir}/tmp`, {recursive: true})
	mkdir(`${user_dir}/www`, {recursive: true})
	mkdir(`${user_dir}/logs`, {recursive: true})
	finish('Created home directory')

	start('Creating home directory')
	mkdir(`${user_dir}`, {recursive: true})
	finish('Created home directory')
}
