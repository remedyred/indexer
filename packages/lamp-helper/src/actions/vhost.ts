import {confirm, mkdir, saveFile} from '@snickbit/node-utilities'
import {config} from '../config'
import ssl from './ssl'
import {$out, cleanDomain} from '../helpers'
import {finish, start} from '../spinner'
import {required} from '../prompt'
import {template} from '../template'
import {run} from '../run'

export default async function () {
	const username = await required('username')
	const domain = cleanDomain(await required('domain'))

	$out.info('Starting VirtualHost creation')

	const user_dir = `/home/${username}`
	const domain_dir = `${user_dir}/www/${domain}`

	$out.info('Creating domain directory')
	mkdir(domain_dir, {recursive: true})

	start('Generating virtualhost file')
	const vhost_file = `/etc/apache2/sites-available/${domain}.conf`
	saveFile(vhost_file, template('vhost', {domain, admin_email: await config('admin.email'), username}))
	finish('Generated virtualhost file')

	start('Enabling virtualhost')
	await run('a2ensite', domain)
	finish('Enabled virtualhost')

	start('Reloading apache')
	await run('service', 'apache2', 'reload')
	finish('Reloaded apache')

	if (await confirm('Enable SSL for this domain?')) {
		await ssl()
	}
}
