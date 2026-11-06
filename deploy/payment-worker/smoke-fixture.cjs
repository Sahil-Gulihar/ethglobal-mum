const { createServer } = require("node:http");

let deliveries = 0;
createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const data = JSON.parse(body);
  if (req.url === "/webhook") {
    if (!req.headers["wc-signature"] || data.id !== "evt_smoke") {
      res.writeHead(400).end();
      return;
    }
    deliveries++;
    console.log(`Received ${data.id}, delivery ${deliveries}`);
    res.writeHead(deliveries === 1 ? 503 : 204).end();
    return;
  }

  const results = { eth_blockNumber: "0xbccdc5", eth_getLogs: [] };
  const reply = { jsonrpc: "2.0", id: data.id };
  if (Object.hasOwn(results, data.method)) reply.result = results[data.method];
  else reply.error = { code: -32601, message: "Unexpected RPC method" };
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(reply));
}).listen(8080);
