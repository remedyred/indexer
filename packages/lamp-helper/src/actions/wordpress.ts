import {config} from '../config'
import {mkdir, saveFile} from '@snickbit/node-utilities'
import {$out, cleanDomain} from '../helpers'
import {finish, start} from '../spinner'
import {run, runIn, test} from '../run'
import {confirm, required} from '../prompt'
import {template} from '../template'

export default async function () {
	const username = await required('username')
	const domain = cleanDomain(await required('domain'))
	const site_name = await required('site_name')

	$out.info('Starting WordPress installation')

	if (!(await test('mysql', '-e', `SHOW DATABASES LIKE '${username}';`))) {
		start('Creating MySQL database & user for ' + username + '...')
		await run('mysql', '-e', `CREATE DATABASE IF NOT EXISTS ${username};`)
		await run('mysql', '-e', `GRANT ALL PRIVILEGES ON ${username}.* TO '${username}'@'localhost' IDENTIFIED BY '${username}';`)
		await run('mysql', '-e', `FLUSH PRIVILEGES;`)
		finish('Created MySQL database & user for ' + username)
	}

	const user_dir = `/home/${username}`
	const domain_dir = `${user_dir}/${domain}`

	mkdir(`${domain_dir}/tmp`, {recursive: true})

	start('Downloading WordPress...')
	await runIn(domain_dir,
		'wp', 'core', 'download', '--allow-root', '--force'
	)
	finish('Downloaded WordPress')

	start('Generating wp-config.php...')
	await runIn(domain_dir,
		'wp', 'config', 'create', '--allow-root', '--force',
		`--dbname=${username}`, `--dbuser=${username}`, `--dbpass=${username}`
	)
	finish('Generated wp-config.php')

	start('Installing WordPress...')
	await runIn(domain_dir,
		'wp', 'core', 'install', '--skip-email', '--allow-root',
		`--url=${domain}`, `--title=${site_name}`, `--admin_user=${await config('admin.username')}`,
		`--admin_password=${await config('admin.password')}`, `--admin_email=${await config('admin.email')}`
	)

	if (await confirm('Add user as admin?')) {
		await runIn(domain_dir,
			'wp', 'user', 'create', '--allow-root',
			username, await config('user_email'), `--user_pass=${username}`,
			`--role=administrator`
		)
	}

	finish('WordPress installed for ' + domain)

	start('Generating PHP-FPM pool file')
	saveFile(`/etc/php/7.4/fpm/pool.d/${domain}.conf`, template('pool', {domain, username, date: new Date().toISOString()}))
	finish('Generated PHP-FPM pool file')

	start('Reloading PHP-FPM')
	await run('service', 'php7.4-fpm', 'reload')
	finish('Reloaded PHP-FPM')
}
