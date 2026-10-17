// Self-check for the dupe matcher. Run: node src/scraper/dupe.test.ts
import assert from 'node:assert'
import { findDupe } from './dupe.ts'

const list = [
  { url: 'https://a.com/x', name: 'Amara Lip Top', brand: 'Brandy Melville' },
  { url: 'https://b.com/y', name: 'Elsie Sweater', brand: 'Hollister' },
  { url: null, name: 'Ribbed Tank', brand: '' },
]

// exact URL match wins regardless of name
assert.equal(findDupe(list, { url: 'https://a.com/x', name: 'something else' })?.name, 'Amara Lip Top')
// same name + brand, different URL
assert.equal(
  findDupe(list, { url: 'https://c.com/z', name: '  amara lip top ', brand: 'Brandy Melville' })?.name,
  'Amara Lip Top',
)
// same name, different brand -> not a dupe
assert.equal(findDupe(list, { url: 'https://c.com/z', name: 'Elsie Sweater', brand: 'Brandy Melville' }), undefined)
// empty name never matches by name
assert.equal(findDupe(list, { url: 'https://d.com', name: '' }), undefined)
// genuinely new item
assert.equal(findDupe(list, { url: 'https://d.com', name: 'New Dress', brand: 'Hollister' }), undefined)
console.log('dupe.test.ts: all assertions passed')