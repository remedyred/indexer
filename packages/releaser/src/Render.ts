import logUpdate from 'log-update'
import {Cycle} from '@snickbit/cycle'
import {template} from 'ansi-styles-template'

export interface RenderData {
	[key: string]: RenderDefinition;
}

export interface RenderDefinition {
	color: string;
	text: string[];
}

const cycle = new Cycle('ansi')

export class Render {
	data: RenderData = {}
	proxy: Render

	constructor() {
		this.proxy = new Proxy(this, {
			get: (target, prop: string, receiver) => {
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

		return this
	}

	private _log(key, text) {
		// this.data[key].text.push(text)
		this.data[key].text = [...this.data[key].text.slice(-5), text]
		this.render()
	}

	add(key: string, ...text: string[]): Renderer {
		this.data[key] = {
			color: cycle.next(),
			text
		}
		return new Renderer(this, key)
	}

	render() {
		let output = []
		for (let key in this.data) {
			const {color, text} = this.data[key]
			output.push(template(`\n{${color}}${key}{/${color}}`))

			for (let txt of text) {
				output.push(template(` {${color}}--{/${color}} ${txt}`))
			}
		}

		logUpdate(output.join('\n'))
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
