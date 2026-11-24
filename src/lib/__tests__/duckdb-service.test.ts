import { describe, it, expect } from 'vitest'
import {
  quoteIdent,
  quoteLiteral,
  TABLE_NAME,
  DEFAULT_LIMIT,
  DEFAULT_TIMEOUT_MS,
  classifyJoinRelationship,
  toSafeDiagnosticNumber,
  isReadOnlyDuckDbStatement,
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

describe('toSafeDiagnosticNumber', () => {
  it('preserves safe bigint and integer string diagnostics', () => {
    expect(toSafeDiagnosticNumber(42n, 'rows')).toBe(42);
    expect(toSafeDiagnosticNumber('9007199254740991', 'rows')).toBe(Number.MAX_SAFE_INTEGER);
    expect(toSafeDiagnosticNumber({ toString: () => '12345' }, 'rows')).toBe(12345);
  });

  it('rejects values that JavaScript cannot represent exactly', () => {
    expect(() => toSafeDiagnosticNumber(9007199254740992n, 'joined_rows')).toThrow(/دقة الأعداد الآمنة/);
    expect(() => toSafeDiagnosticNumber(9007199254740992, 'joined_rows')).toThrow(/دقة الأعداد الآمنة/);
  });
});


describe('isReadOnlyDuckDbStatement', () => {
  it('allows plain SELECT and planning-only EXPLAIN without treating them as mutations', () => {
    expect(isReadOnlyDuckDbStatement('SELECT * FROM dataset')).toBe(true);
    expect(isReadOnlyDuckDbStatement('  select 1')).toBe(true);
    expect(isReadOnlyDuckDbStatement('EXPLAIN SELECT * FROM dataset')).toBe(true);
    expect(isReadOnlyDuckDbStatement('EXPLAIN (FORMAT JSON) SELECT * FROM dataset')).toBe(true);
  });

  it('conservatively treats compound or potentially executing statements as mutations', () => {
    expect(isReadOnlyDuckDbStatement('WITH x AS (SELECT 1) SELECT * FROM x')).toBe(false);
    expect(isReadOnlyDuckDbStatement('WITH x AS (DELETE FROM dataset RETURNING *) SELECT * FROM x')).toBe(false);
    expect(isReadOnlyDuckDbStatement('EXPLAIN ANALYZE SELECT * FROM dataset')).toBe(false);
    expect(isReadOnlyDuckDbStatement('CREATE OR REPLACE VIEW dataset AS SELECT 1')).toBe(false);
    expect(isReadOnlyDuckDbStatement('INSERT INTO dataset VALUES (1)')).toBe(false);
  });

  it('rejects trailing statements so a leading SELECT cannot hide a mutation', () => {
    expect(isReadOnlyDuckDbStatement('SELECT 1; DELETE FROM dataset')).toBe(false);
    expect(isReadOnlyDuckDbStatement('SELECT 1; CREATE TABLE shadow AS SELECT 2')).toBe(false);
    expect(isReadOnlyDuckDbStatement('SELECT 1;')).toBe(true);
  });

  it('ignores semicolons inside strings and comments while classifying the statement', () => {
    expect(isReadOnlyDuckDbStatement("SELECT '; DELETE FROM dataset'")).toBe(true);
    expect(isReadOnlyDuckDbStatement('-- read-only query\nSELECT * FROM dataset;')).toBe(true);
  });

  it('fails closed when SQL scanning cannot establish safe boundaries', () => {
    expect(isReadOnlyDuckDbStatement("SELECT 'unterminated")).toBe(false);
    expect(isReadOnlyDuckDbStatement('/* unterminated SELECT * FROM dataset')).toBe(false);
  });
});
