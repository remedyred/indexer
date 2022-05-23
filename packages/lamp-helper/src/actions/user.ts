import {confirm, getFile, mkdir} from '@snickbit/node-utilities'
import {$out, finish, hash, required, run, start} from '../helpers'

export default async function () {
	const username = await required('username')

	$out.info('Starting user creation')

	const passwd = getFile('/etc/passwd')
	if (!passwd.match(new RegExp(`^${username}`, 'm')) || await confirm(`User ${username} already exists! Overwrite the old password?`)) {
		const password = await required('password', {type: 'password'})

		start('Creating user and setting password')
		await run('useradd', '-M', '-p', await hash(password), username)
		finish('Created user and set password')
	}

	start('Creating home directory')
	let user_dir = `/home/${username}`
	mkdir(`${user_dir}`, {recursive: true})
	finish('Created home directory')
}
