import {Cycle} from '@snickbit/cycle'
import {template} from 'ansi-styles-template'
import {saveFile} from '@snickbit/node-utilities'
import {JSONPrettify} from '@snickbit/utilities'
import UpdateManager from 'stdout-update'

export interface RenderData {
	[key: string]: RenderDefinition
}

export interface RenderDefinition {
	color: string
	text: string[]
}

const manager = UpdateManager.getInstance()
const logfile = `${process.cwd()}/render.log`

const cycle = new Cycle('ansi')

export class Render {
	data: RenderData = {}
	proxy: Render
	limit = 5

	constructor() {
		this.proxy = new Proxy(this, {
			get(target, prop: string, receiver) {
				if (prop in target.data) {
					return target.data[prop]
				}
				return Reflect.get(target, prop, receiver)
			},
			set: (target, prop: string, value) => {
				if (prop in target.data) {
					target.data[prop] = value
					this.render()
					return true
				}
				return Reflect.set(target, prop, value)
			}
		})

		process.on('exit', () => {
			if (this.limit <= 0) {
				saveFile(logfile, JSONPrettify(this.data))
			}
		})

		return this
	}

	add(key: string, ...text: string[]): Renderer {
		this.data[key] = {
			color: cycle.next(),
			text
		}
		return new Renderer(this, key)
	}

	erase(count = 1) {
		manager.erase(count)
	}

	start() {
		manager.hook()
	}

	stop(separateHistory = true) {
		manager.unhook(separateHistory)
	}

	render() {
		let output = []
		for (let key in this.data) {
			const {color, text} = this.data[key]
			output.push('', template(`{${color}}${key}{/${color}}`))

			for (let txt of text) {
				output.push(template(` {${color}}--{/${color}} ${txt}`))
			}
		}

		manager.update(output)
	}

	warn(key: string, text: string) {
		this._log(key, `{yellow}${text}{/yellow}`)
		return this
	}

	error(key: string, text: string) {
		this._log(key, `{red}${text}{/red}`)
		return this
	}

	info(key: string, text: string) {
		this._log(key, `{cyan}${text}{/cyan}`)
		return this
	}

	success(key: string, text: string) {
		this._log(key, `{green}${text}{/green}`)
		return this
	}

	log(key: string, text: string) {
		this._log(key, text)
		return this
	}

	private _log(key, text) {
		if (!this.limit || this.limit < 0) {
			this.data[key].text.push(text)
		} else {
			this.data[key].text = [...this.data[key].text.slice(this.limit * -1), text]
		}
		this.render()
	}
}

export class Renderer {
	key: string
	parent: Render

	constructor(parent, key) {
		this.parent = parent
		this.key = key
	}

	warn(text: string) {
		return this.parent.warn(this.key, text)
	}

	error(text: string) {
		return this.parent.error(this.key, text)
	}

	info(text: string) {
		return this.parent.info(this.key, text)
	}

	success(text: string) {
		return this.parent.success(this.key, text)
	}

	log(text: string) {
		return this.parent.log(this.key, text)
	}
}
