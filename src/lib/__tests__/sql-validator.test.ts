import { describe, it, expect } from "vitest";
import { validateQuery } from "../sql-validator";
import { ensureLimit, scanSql } from "../sql-tokenize";

const schema = { tables: { dataset: ["a", "b", "d", "name"] } };
const valid = (q: string) => validateQuery(q, schema);

describe("validateQuery: bypasses that used to pass", () => {
  const bad: Record<string, string> = {
    "string containing --": "SELECT '--', a FROM dataset; DROP TABLE dataset; SELECT 1",
    "string containing /*": "SELECT '/*' FROM dataset; DROP TABLE dataset; SELECT '*/' FROM dataset",
    "comma join read_csv": "SELECT * FROM dataset, read_csv('/etc/passwd')",
    "string literal source": "SELECT * FROM 'https://evil.example/x.csv'",
    "string source after comma": "SELECT * FROM dataset, 'x.csv'",
    "join string source": "SELECT * FROM dataset JOIN 'x.csv' ON true",
    "cte named like function": "WITH read_csv AS (SELECT 1) SELECT * FROM read_csv('x')",
    "scalar getenv": "SELECT getenv('HOME') FROM dataset",
    "glob listing": "SELECT * FROM glob('*')",
    "bare unknown comma table": "SELECT * FROM dataset, \"data.csv\"",
    "E-string escape trick": "SELECT E'\\'' FROM dataset; DROP TABLE dataset; --'",
    "unterminated string": "SELECT 'abc FROM dataset",
    "unterminated comment": "SELECT a FROM dataset /* x",
    "nested comment": "SELECT a FROM dataset /* /* */ ; DROP TABLE dataset */",
    "dollar quoted hides text": "SELECT $$ ; $$, a FROM dataset; DROP TABLE dataset",
    "plain multi statement": "SELECT a FROM dataset; DROP TABLE dataset",
    "double semicolon": "SELECT a FROM dataset;;",
    "from-first string": "WITH x AS (FROM 'file.csv') SELECT * FROM x",
  };
  for (const [name, q] of Object.entries(bad)) {
    it(`rejects: ${name}`, () => {
      expect(valid(q).isValid).toBe(false);
    });
  }
});

describe("validateQuery: legitimate queries still pass", () => {
  const good = [
    "SELECT a, b FROM dataset",
    "SELECT a, count(*) AS n FROM dataset GROUP BY a ORDER BY n DESC",
    "SELECT * FROM dataset WHERE name = 'a -- b' AND a > 3",
    "SELECT * FROM dataset WHERE name LIKE '%/*%'",
    "WITH t AS (SELECT a FROM dataset) SELECT * FROM t",
    "SELECT a FROM dataset WHERE a IN (SELECT a FROM dataset LIMIT 3)",
    "SELECT concat(a, '') FROM dataset",
    "SELECT a FROM dataset; ",
    "SELECT a FROM dataset -- trailing comment",
  ];
  for (const q of good) {
    it(`accepts: ${q}`, () => {
      const r = valid(q);
      expect(r.rejectionReason ?? "").toBe("");
      expect(r.isValid).toBe(true);
    });
  }
});

// قيود قديمة (قبل هذا الإصلاح): الفحص القائم على regex لا يفهم هاتين الحالتين
describe("known limitations (pre-existing)", () => {
  it.todo("accepts extract(year FROM col)");
  it.todo("accepts aliases of comma-joined tables");
});

describe("limit enforcement", () => {
  it("appends a limit on its own line so a trailing comment cannot swallow it", () => {
    const r = valid("SELECT a FROM dataset -- limit 5");
    expect(r.sanitizedQuery).toMatch(/\nLIMIT 1000$/);
    expect(r.sanitizedQuery).not.toContain("--");
  });
  it("clamps huge limits even with a trailing comment", () => {
    expect(valid("SELECT a FROM dataset LIMIT 999999 -- x").sanitizedQuery).toMatch(/LIMIT 5000$/);
  });
  it("keeps OFFSET and does not add a second LIMIT", () => {
    const q = valid("SELECT a FROM dataset LIMIT 10 OFFSET 5").sanitizedQuery!;
    expect(q.match(/limit/gi)).toHaveLength(1);
    expect(q).toMatch(/OFFSET 5$/);
  });
  it("ignores LIMIT inside strings and subqueries", () => {
    expect(ensureLimit("SELECT * FROM t WHERE x = 'limit 5'", 100)).toMatch(/\nLIMIT 100$/);
    expect(ensureLimit("SELECT * FROM t WHERE a IN (SELECT a FROM u LIMIT 3)", 100)).toMatch(/\nLIMIT 100$/);
  });
});

describe("scanSql", () => {
  it("blanks strings but keeps quoted identifiers", () => {
    const r = scanSql(`SELECT "a--b", 'x;y' FROM t`);
    expect(r.ok && r.skeleton).toContain(`"a--b"`);
    expect(r.ok && r.skeleton).not.toContain("x;y");
  });
});
