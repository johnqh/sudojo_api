/**
 * A tiny stand-in for the postgres.js client, for route tests that must not
 * touch a database.
 *
 * Routes run against a real Drizzle instance (`drizzle({ client })`), so the
 * SQL text, the bound params, and the row mapping (e.g. `bigint` columns ->
 * `BigInt(value)`) are Drizzle's own. The stub records every statement and
 * keeps rows per table in their wire form, the way postgres.js would hand
 * them back: int8 as a decimal string, timestamps as `YYYY-MM-DD hh:mm:ss`.
 *
 * It understands just enough of Drizzle's generated SQL for the routes under
 * test: SELECT ... FROM, INSERT ... VALUES ... RETURNING, UPDATE ... SET ...
 * RETURNING, DELETE ... RETURNING. WHERE, ORDER BY and LIMIT are ignored --
 * seed only the rows a test should see.
 */
import { drizzle } from "drizzle-orm/postgres-js";

export interface ExecutedQuery {
  query: string;
  params: unknown[];
}

type Row = Record<string, unknown>;

/** Split a comma list at the top level (not inside parentheses). */
function splitTopLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** `"boards"."uuid"` or `"uuid"` -> `uuid`; anything else -> null. */
function columnName(expr: string): string | null {
  const match = /"(\w+)"$/.exec(expr.trim());
  return match ? match[1]! : null;
}

/** A bound param as postgres would store and return it. */
function toWire(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value)) {
    return value.slice(0, -1).replace("T", " ");
  }
  return value;
}

function paramValue(token: string, params: unknown[]): unknown {
  const match = /^\$(\d+)$/.exec(token.trim());
  return match ? toWire(params[Number(match[1]) - 1]) : null;
}

export function createFakePostgres() {
  const executed: ExecutedQuery[] = [];
  const tables = new Map<string, Row[]>();
  let nextUuid = 1;

  const rowsOf = (table: string) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table)!;
  };

  function project(rows: Row[], list: string, allRows: Row[]): unknown[][] {
    const exprs = splitTopLevel(list);
    return rows.map(row =>
      exprs.map(expr => {
        if (/^count\(/i.test(expr)) return allRows.length;
        const name = columnName(expr);
        return name === null ? null : (row[name] ?? null);
      })
    );
  }

  function run(query: string, params: unknown[]): unknown[][] {
    const q = query.replace(/\s+/g, " ").trim();
    const returning = /\breturning (.*)$/i.exec(q)?.[1];

    let match = /^select (.*?) from "(\w+)"/i.exec(q);
    if (match) {
      const all = rowsOf(match[2]!);
      if (/^count\(/i.test(match[1]!.trim())) return [[all.length]];
      return project(all, match[1]!, all);
    }

    match = /^insert into "(\w+)" \((.*?)\) values \((.*?)\)/i.exec(q);
    if (match) {
      const columns = splitTopLevel(match[2]!).map(c => columnName(c)!);
      const values = splitTopLevel(match[3]!);
      const row: Row = {};
      columns.forEach((column, i) => {
        const token = values[i]!;
        row[column] =
          token === "default"
            ? column === "uuid" || column === "id"
              ? `00000000-0000-4000-8000-${String(nextUuid++).padStart(12, "0")}`
              : null
            : paramValue(token, params);
      });
      rowsOf(match[1]!).push(row);
      return returning ? project([row], returning, [row]) : [];
    }

    match = /^update "(\w+)" set (.*?)(?: where .*?)?(?: returning .*)?$/i.exec(
      q
    );
    if (match) {
      const rows = rowsOf(match[1]!);
      for (const assignment of splitTopLevel(match[2]!)) {
        const [lhs, rhs] = assignment.split(" = ");
        const column = columnName(lhs!)!;
        for (const row of rows) row[column] = paramValue(rhs!, params);
      }
      return returning ? project(rows, returning, rows) : [];
    }

    match = /^delete from "(\w+)"/i.exec(q);
    if (match) {
      const rows = rowsOf(match[1]!);
      tables.set(match[1]!, []);
      return returning ? project(rows, returning, rows) : [];
    }

    return [];
  }

  const client = {
    options: { parsers: {}, serializers: {} },
    unsafe(query: string, params: unknown[] = []) {
      executed.push({ query, params });
      const rows = run(query, params);
      return Object.assign(Promise.resolve(rows), {
        values: () => Promise.resolve(rows),
      });
    },
  };

  return {
    db: drizzle({ client: client as never }),
    executed,
    tables,
    /** Replace a table's rows. Give int8 columns as decimal strings. */
    seed(table: string, rows: Row[]) {
      tables.set(
        table,
        rows.map(row => ({ ...row }))
      );
    },
    reset() {
      executed.length = 0;
      tables.clear();
      nextUuid = 1;
    },
  };
}

export type FakePostgres = ReturnType<typeof createFakePostgres>;

/**
 * One instance per test file (vitest isolates module registries per file).
 * `vi.mock` factories are hoisted above imports, so they reach it with
 * `await import("./fake-postgres")` and the test body imports it normally.
 */
export const fakePostgres = createFakePostgres();
