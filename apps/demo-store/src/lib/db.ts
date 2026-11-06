import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { StoreData } from "./types";

// A tiny JSON-file "database". Good enough for a demo merchant; all writes are
// serialised through one promise chain and written atomically (tmp + rename).
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "orders.json");

const empty = (): StoreData => ({ orders: {}, processedEventIds: [], webhookLog: [] });

export async function readStore(): Promise<StoreData> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return { ...empty(), ...(JSON.parse(raw) as Partial<StoreData>) };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return empty();
    throw err;
  }
}

let queue: Promise<unknown> = Promise.resolve();

/** Read-modify-write under a process-wide lock. */
export function updateStore<T>(fn: (data: StoreData) => T | Promise<T>): Promise<T> {
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
