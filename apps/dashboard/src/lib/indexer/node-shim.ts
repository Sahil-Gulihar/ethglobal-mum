/**
 * For plain Node scripts (tsx): `server-only` throws outside Next's react-server condition.
 * Import this FIRST, then dynamic-import modules that use "server-only".
 */
import Module, { createRequire } from "node:module";

const req = createRequire(__filename);
const resolved = req.resolve("server-only");
if (!req.cache[resolved]) {
  const m = new Module(resolved);
  m.filename = resolved;
  m.loaded = true;
  m.exports = {};
  req.cache[resolved] = m;
}
export {};
