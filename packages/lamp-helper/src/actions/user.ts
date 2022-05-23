import {confirm, getFile, mkdir} from '@snickbit/node-utilities'
import {$out, finish, hash, required, run, start} from '../helpers'

export default async function () {
	const username = await required('username')

	$out.info('Starting user creation')

	const passwd = getFile('/etc/passwd')
	if (!passwd.match(new RegExp(`^${username}`, 'm')) || await confirm(`User ${username} already exists! Overwrite the old password?`)) {
		start('Creating user and setting password')
		await run('useradd', '-s', '/bin/false', '-M', '-p', await hash(username), username)
		finish('Created user and set password')
	}

	start('Creating home directory')
	let user_dir = `/home/${username}`
	mkdir(`${user_dir}`, {recursive: true})
	finish('Created home directory')
}
