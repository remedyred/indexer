#!/usr/bin/env node

import {cli} from '@snickbit/node-cli'
import {out} from '@snickbit/out'
import * as actions from './actions'


cli()
.name('@snickbit/releaser')
.arg('bump')
.actions(actions)
.options({
	config: {
		alias: 'c',
		description: 'Release config file'
	},
	dryRun: {
		alias: 'd',
		description: 'Dry run',
		type: 'boolean'
	}
})
.defaultAction('release')
.run()
.then(() => out.done('Done!'))
.catch(err => out.error(err))
