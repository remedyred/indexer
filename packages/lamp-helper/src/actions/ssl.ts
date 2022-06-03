import {config} from '../config'
import {$out, cleanDomain} from '../helpers'
import {finish, start} from '../spinner'
import {required} from '../prompt'
import {run} from '../run'

export default async function() {
	const domain = cleanDomain(await required('domain'))

	$out.info('Starting SSL certificate creation')

	start(`Creating SSL certificate for ${domain}`)
	await run(
		'certbot', '--apache', '--agree-tos', '--non-interactive', '--email', await config('admin.email'), '-d', domain, '-d', `www.${domain}`
	)
	finish(`Created SSL certificate for ${domain}`)
}
