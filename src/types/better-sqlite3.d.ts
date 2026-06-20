declare module "better-sqlite3" {
  interface Statement {
    get(...params: unknown[]): Record<string, unknown>;
    all(...params: unknown[]): Record<string, unknown>[];
    run(...params: unknown[]): void;
  }
  export default class Database {
    constructor(path: string, opts?: { readonly?: boolean });
    prepare(sql: string): Statement;
    close(): void;
  }
}
