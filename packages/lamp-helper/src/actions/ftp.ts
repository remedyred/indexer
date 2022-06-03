import {getFile, saveFile} from '@snickbit/node-utilities'
import {$out} from '../helpers'
import {finish, start} from '../spinner'
import {required} from '../prompt'
import {run} from '../run'
import {template} from '../template'

export default async function() {
	const username = await required('username')

	$out.info('Starting FTP account creation')

	const ftp_group = 'ftp'
	const groups = getFile('/etc/group')
	let sshd_config = getFile('/etc/ssh/sshd_config', '')

	if (!new RegExp(`^${ftp_group}`, 'm').test(groups)) {
		start('Creating FTP group')
		await run('groupadd', ftp_group)
		sshd_config += `\n\n${template('sshd_group', {group: ftp_group})}`
		finish('FTP group created')
	}

	start('Adding user to FTP group')
	await run('usermod', '-a', '-G', ftp_group, username)
	finish('User added to FTP group')

	start('Updating SSH config')
	saveFile('/etc/ssh/sshd_config', sshd_config)
	finish('SSH config updated')

	start('Reloading SSH')
	await run('service', 'ssh', 'restart')
	finish('SSH reloaded')
}
