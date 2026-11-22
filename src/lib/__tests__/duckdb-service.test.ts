import { describe, it, expect } from 'vitest'
import {
  quoteIdent,
  quoteLiteral,
  TABLE_NAME,
  DEFAULT_LIMIT,
  DEFAULT_TIMEOUT_MS,
  classifyJoinRelationship,
} from '../duckdb-service'

describe('quoteIdent', () => {
  it('wraps normal name in double quotes', () => {
    expect(quoteIdent('name')).toBe('"name"')
  })

  it('escapes internal double quote', () => {
    expect(quoteIdent('my"col')).toBe('"my""col"')
  })

  it('handles Arabic names', () => {
    expect(quoteIdent('column name')).toBe('"column name"')
  })

  it('handles empty name', () => {
    expect(quoteIdent('')).toBe('""')
  })

  it('handles names with spaces', () => {
    expect(quoteIdent('my column')).toBe('"my column"')
  })
})

describe('quoteLiteral', () => {
  it('wraps value in single quotes', () => {
    expect(quoteLiteral('value')).toBe("'value'")
  })

  it('escapes internal single quote', () => {
    expect(quoteLiteral("it's")).toBe("'it''s'")
  })

  it('handles empty value', () => {
    expect(quoteLiteral('')).toBe("''")
  })

  it('handles Arabic values', () => {
    expect(quoteLiteral('hello')).toBe("'hello'")
  })

  it('handles single quote only', () => {
    expect(quoteLiteral("'")).toBe("''''")
  })
})

describe('exported constants', () => {
  it('TABLE_NAME equals dataset', () => {
    expect(TABLE_NAME).toBe('dataset')
  })

  it('DEFAULT_LIMIT equals 1000', () => {
    expect(DEFAULT_LIMIT).toBe(1000)
  })

  it('DEFAULT_TIMEOUT_MS equals 10000', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(10000)
  })
})

describe('classifyJoinRelationship', () => {
  it('identifies one-to-one, one-to-many, many-to-one, many-to-many and no-match', () => {
    expect(classifyJoinRelationship(1, 1)).toBe('one-to-one');
    expect(classifyJoinRelationship(1, 4)).toBe('one-to-many');
    expect(classifyJoinRelationship(3, 1)).toBe('many-to-one');
    expect(classifyJoinRelationship(2, 5)).toBe('many-to-many');
    expect(classifyJoinRelationship(0, 0)).toBe('no-match');
  });
});
