import cli from '@snickbit/node-cli'
import vhost from '../actions/vhost'

export default async argv => cli(argv).args({
	username: {
		description: 'Username to create',
		type: 'string'
	},
	domain: {
		description: 'Domain to create',
		type: 'string'
	}
}).run(async (args) => vhost(args.username as string, args.domain as string))
