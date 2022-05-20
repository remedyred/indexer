import {PackageInfo} from 'workspace-tools'
import path from 'path'
import {objectExcept} from '@snickbit/utilities'
import {PackageJson, ShouldPublishResults} from './definitions'

export interface Pkg extends PackageJson {
	[key: string]: any
}

export class Pkg {
	protected proxy: Pkg
	data: PackageInfo
	dir: string
	path: string
	npm_version: string
	should_publish: boolean
	behind_upstream: number

	constructor(packageInfo: PackageInfo, should_publish?: ShouldPublishResults) {
		this.dir = path.dirname(packageInfo.packageJsonPath)
		this.path = packageInfo.packageJsonPath
		this.data = packageInfo

		if (should_publish) {
			this.npm_version = should_publish.npm_version
			this.should_publish = should_publish.pass
			this.behind_upstream = should_publish.behindUpstream
		}

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
			set(target: Pkg, prop: string, value?: any) {
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
		return JSON.stringify(this.toJSON(), null, 2)
	}

	toJSON(): PackageJson {
		return objectExcept(this.data, ['packageJsonPath']) as PackageJson
	}
}
