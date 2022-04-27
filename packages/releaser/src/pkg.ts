import {PackageJson} from './config'
import {ShouldPublishResults} from './release'

export interface Pkg extends PackageJson {
}

export class Pkg {
	protected proxy: Pkg
	data: PackageJson
	dir: string
	path: string
	npm_version: string
	should_publish: boolean
	behind_upstream: boolean

	constructor(data: PackageJson, packageDir: string, should_publish: ShouldPublishResults) {
		this.data = data
		this.dir = packageDir
		this.path = packageDir + '/package.json'
		this.npm_version = should_publish.npm_version
		this.should_publish = should_publish.results
		this.behind_upstream = !!should_publish.behindUpstream

		this.proxy = new Proxy(this, {
			get(target: Pkg, prop: string, receiver?: any): any {
				if (prop in target) {
					return target[prop]
				}

				if (prop in target.data) {
					return target.data[prop]
				}

				return Reflect.get(target, prop, receiver)
			},
			set: function (target: Pkg, prop: string, value?: any) {
				if (prop in target) {
					target[prop] = value
					return true
				}

				if (prop in target.data) {
					target.data[prop] = value
					return true
				}

				return Reflect.set(target, prop, value)
			}
		})

		return this.proxy
	}

	get scripts(): Record<string, string> {
		return this.data.scripts
	}

	toString(): string {
		return JSON.stringify(this.data, null, 2)
	}

	toJSON(): PackageJson {
		return this.data
	}
}
