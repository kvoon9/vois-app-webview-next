import { pinyin } from 'pinyin-pro'

/** The App files digits and symbols under `#`, then A-Z. */
export const INITIALS = [
  '#',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
] as const
export type Initial = (typeof INITIALS)[number]

const HAN = /[一-鿿]/
const LATIN = /[A-Za-z]/
const INITIAL_SET = new Set<string>(INITIALS)

function initialOf(letter: string): Initial | null {
  // SAFETY: the set holds exactly the INITIALS members, so a hit is one of them.
  return INITIAL_SET.has(letter) ? (letter as Initial) : null
}

/** The letter the App's A-Z rail would file this name under. */
export function contactInitial(name: string): Initial {
  const first = name.trim().charAt(0)
  if (!first) return '#'
  if (LATIN.test(first)) return initialOf(first.toUpperCase()) ?? '#'
  if (!HAN.test(first)) return '#'
  const letter = pinyin(first, { pattern: 'first', toneType: 'none' }).charAt(0).toUpperCase()
  return initialOf(letter) ?? '#'
}

function sortKey(name: string): string {
  const first = name.trim().charAt(0)
  if (!HAN.test(first)) return name.toLowerCase()
  return pinyin(name, { toneType: 'none', type: 'array' }).join(' ')
}

export interface ContactEntry<T> {
  item: T
  initial: Initial
}

/** Native orders the address book by initial, then by pinyin, not by API order. */
export function sortContactsByInitial<T>(
  items: readonly T[],
  nameOf: (item: T) => string,
): ContactEntry<T>[] {
  const rank = (initial: Initial) => INITIALS.indexOf(initial)
  return items
    .map((item) => {
      const name = nameOf(item)
      return { item, initial: contactInitial(name), key: sortKey(name) }
    })
    .sort((left, right) => {
      const byInitial = rank(left.initial) - rank(right.initial)
      return byInitial !== 0 ? byInitial : left.key.localeCompare(right.key, 'en')
    })
    .map(({ item, initial }) => ({ item, initial }))
}
