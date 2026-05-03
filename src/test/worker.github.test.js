import { describe, it, expect } from 'vitest'
import { decodeGitHubContent, encodeGitHubContent, locationFilePath } from '../worker/github.js'

describe('encodeGitHubContent / decodeGitHubContent', () => {
  it('round-trips ASCII content', () => {
    const original = 'locationId: 1\ntitle: Test\n'
    expect(decodeGitHubContent(encodeGitHubContent(original))).toBe(original)
  })

  it('round-trips UTF-8 content (accented characters)', () => {
    const original = 'title: Café de Unie\naddress: Plein 1\n'
    expect(decodeGitHubContent(encodeGitHubContent(original))).toBe(original)
  })

  it('strips whitespace from base64 before decoding (GitHub API wraps at 76 chars)', () => {
    const original = 'hello: world\n'
    const encoded = encodeGitHubContent(original)
    const withNewlines = encoded.replace(/.{10}/g, '$&\n')
    expect(decodeGitHubContent(withNewlines)).toBe(original)
  })
})

describe('locationFilePath', () => {
  it('builds the canonical data path', () => {
    expect(locationFilePath('democrats_abroad', 'den_haag', '001_loc_test.yaml'))
      .toBe('src/data/text/en/projects/democrats_abroad/den_haag/001_loc_test.yaml')
  })
})