import cli from '@snickbit/node-cli'
import user from '../actions/user'

export default async argv => cli(argv).args({
	username: {
		description: 'Username to create',
		type: 'string'
	}
}).run(async (args) => user(args.username as string))
