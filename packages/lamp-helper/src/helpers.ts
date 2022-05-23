import {Out} from '@snickbit/out'
import {hash as bcryptHash} from 'bcrypt-ts'

export const $out = new Out('lamp')

export async function hash(password): Promise<string> {
	return bcryptHash(password, 10)
}

export function cleanDomain(domain: string) {
	//trim http:// | https:// | www | and all spaces from domain
	return domain.replace(/\s/g, '').replace(/^(http|https):\/\//, '').replace(/^www\./, '')
}

