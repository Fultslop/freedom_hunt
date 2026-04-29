import { describe, it, expect } from 'vitest'
import { buildR2Key } from '../worker.js'

describe('buildR2Key', () => {
  it('uses jpg extension for jpeg mime type', () => {
    expect(buildR2Key('001', 'image/jpeg', 1000000)).toBe('001_1000000.jpg')
  })

  it('uses png extension for png mime type', () => {
    expect(buildR2Key('001', 'image/png', 1000000)).toBe('001_1000000.png')
  })

  it('falls back to jpg for unknown mime type', () => {
    expect(buildR2Key('001', 'image/webp', 1000000)).toBe('001_1000000.jpg')
  })
})