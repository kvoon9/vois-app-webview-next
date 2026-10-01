import { number, object, optional, parse, string } from 'valibot'
import { weilaFetch } from '~/utils/api'
import type { AccountProfile } from '~/utils/auth/types'

const profileSchema = object({
  user: object({
    id: number(),
    num: string(),
    nick: optional(string(), ''),
    avatar: optional(string(), ''),
  }),
})

export async function getAccountProfile(): Promise<AccountProfile> {
  const response = await weilaFetch<unknown>('/v2/user/get-my-user-info')
  const { user } = parse(profileSchema, response.data)
  return { userId: user.id, num: user.num, nick: user.nick, avatar: user.avatar }
}
