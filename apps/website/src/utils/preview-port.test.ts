import { describe, expect, it } from 'vite-plus/test'
import { previewPortHref } from './preview-port'

const phoneUrl = new URL('http://192.168.0.1:7890/?access-token=x#/settings')

describe('previewPortHref', () => {
  it('replaces only the port', () => {
    expect(previewPortHref('7891', phoneUrl)).toBe(
      'http://192.168.0.1:7891/?access-token=x#/settings',
    )
  })

  it('keeps the hostname the page was opened with', () => {
    const href = previewPortHref('7891', new URL('http://localhost:5173/a/b?x=1#/c?d=2'))
    expect(href).toBe('http://localhost:7891/a/b?x=1#/c?d=2')
    expect(href).not.toContain('192.168')
  })

  it('adds a port to a URL that has none', () => {
    expect(previewPortHref('8080', new URL('http://192.168.0.1/path#/here'))).toBe(
      'http://192.168.0.1:8080/path#/here',
    )
  })

  it('accepts the highest usable port', () => {
    expect(previewPortHref('65535', phoneUrl)).toContain(':65535/')
  })

  it('ignores surrounding whitespace', () => {
    expect(previewPortHref(' 7891 ', phoneUrl)).toContain(':7891/')
  })

  it.each([
    ['', 'empty'],
    ['abc', 'not a number'],
    ['80.5', 'not an integer'],
    ['-1', 'negative'],
    ['0', 'below range'],
    ['65536', 'above range'],
    ['7891abc', 'partial number'],
  ])('rejects %s (%s)', (port) => {
    expect(previewPortHref(port, phoneUrl)).toBeNull()
  })

  it('does not mutate the location it is given', () => {
    previewPortHref('7891', phoneUrl)
    expect(phoneUrl.href).toBe('http://192.168.0.1:7890/?access-token=x#/settings')
  })
})
