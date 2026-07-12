import pg from "pg";

export function createPool(url = process.env.DATABASE_URL ?? "postgres://wave:wave@localhost:5432/wave") {
  return new pg.Pool({ connectionString: url });
}
export type Pool = pg.Pool;
