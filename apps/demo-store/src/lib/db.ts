import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import type { StoreData } from "./types";

// A tiny "database" for a demo merchant: the whole store is one JSON document.
// - Locally it's data/orders.json, with writes serialised through one promise chain and written
//   atomically (tmp + rename).
// - When STORE_DATABASE_URL is set (serverless hosting, where the filesystem is per-instance and
//   temporary), the document lives in one Postgres row and writes lock that row, so concurrent
//   webhook and order requests on different instances can't overwrite each other.
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "orders.json");
const STORE_KEY = "demo-store";

const empty = (): StoreData => ({ orders: {}, processedEventIds: [], webhookLog: [] });

let sql: postgres.Sql | null = null;
let ready: Promise<void> | null = null;

function pg(): postgres.Sql | null {
  const url = process.env.STORE_DATABASE_URL;
  if (!url) return null;
  if (!sql) {
    sql = postgres(url, { max: 3, prepare: false });
    ready = sql`create table if not exists demo_store_state (key text primary key, data jsonb not null)`.then(() => undefined);
  }
  return sql;
}

export async function readStore(): Promise<StoreData> {
  const db = pg();
  if (db) {
    await ready;
    const [row] = await db<{ data: Partial<StoreData> }[]>`select data from demo_store_state where key = ${STORE_KEY}`;
    return { ...empty(), ...(row?.data ?? {}) };
  }
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return { ...empty(), ...(JSON.parse(raw) as Partial<StoreData>) };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return empty();
    throw err;
  }
}

let queue: Promise<unknown> = Promise.resolve();

/** Read-modify-write under a lock (a row lock in Postgres, a process-wide queue for the file). */
export function updateStore<T>(fn: (data: StoreData) => T | Promise<T>): Promise<T> {
  const db = pg();
  if (db) {
    return (async () => {
      await ready;
      return db.begin(async (tx) => {
        await tx`insert into demo_store_state (key, data) values (${STORE_KEY}, ${tx.json(empty() as never)}) on conflict (key) do nothing`;
        const [row] = await tx<{ data: Partial<StoreData> }[]>`select data from demo_store_state where key = ${STORE_KEY} for update`;
        const data: StoreData = { ...empty(), ...(row?.data ?? {}) };
        const result = await fn(data);
        await tx`update demo_store_state set data = ${tx.json(data as never)} where key = ${STORE_KEY}`;
        return result;
      }) as Promise<T>;
    })();
  }
  const run = queue.then(async () => {
    const data = await readStore();
    const result = await fn(data);
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.${randomBytes(4).toString("hex")}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2));
    await fs.rename(tmp, DATA_FILE);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export function newOrderId(): string {
  return `order_${randomBytes(8).toString("hex")}`;
}
