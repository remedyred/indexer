#!/usr/bin/env node

import {out} from '@snickbit/out'
import cli from '@snickbit/node-cli'
import packageJson from '../package.json'
import * as commands from './commands'

cli()
.name('lamp-helper')
.version(packageJson.version)
.actions(commands)
.run().then(async (/* argv */) => out.done('Done!'))
.catch(err => out.fatal('Error:', err))
