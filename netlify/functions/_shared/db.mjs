import { getConnectionString } from "@netlify/database";
import pg from "pg";

let pool;
export function db() {
  if (!pool) pool = new pg.Pool({ connectionString: getConnectionString() });
  return pool;
}

export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
