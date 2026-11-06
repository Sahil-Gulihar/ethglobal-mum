#!/usr/bin/env bash
set -euo pipefail

image=${1:?Pass the worker image tag}
prefix="payment-smoke-$$"
network="$prefix"
db="$prefix-db"
fixture="$prefix-fixture"
worker="$prefix-worker"

cleanup() {
  docker logs "$worker" 2>&1 || true
  docker logs "$fixture" 2>&1 || true
  docker rm -fv "$worker" "$fixture" "$db" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT

query() {
  docker exec -i -e PGPASSWORD=smoke "$db" psql -h 127.0.0.1 -XAt -v ON_ERROR_STOP=1 -U smoke -d smoke "$@"
}

wait_for() {
  for ((i=0; i<30; i++)); do
    if [[ $(query -c "$1" 2>/dev/null) == "$2" ]]; then return; fi
    sleep 1
  done
  echo "Expected $2 for: $1" >&2
  return 1
}

docker network create --internal "$network" >/dev/null
docker run -d --name "$db" --network "$network" \
  -e POSTGRES_USER=smoke -e POSTGRES_PASSWORD=smoke postgres:16 >/dev/null
wait_for 'SELECT 1' 1
database_url="postgres://smoke:smoke@$db:5432/smoke"
docker run --rm --network "$network" -e DATABASE_URL="$database_url" \
  "$image" pnpm exec drizzle-kit push --force
fixture_script="$(cd "$(dirname "$0")" && pwd)/smoke-fixture.cjs"
docker run -d --name "$fixture" --network "$network" \
  -v "$fixture_script:/smoke-fixture.cjs:ro" "$image" node /smoke-fixture.cjs >/dev/null

query <<SQL
INSERT INTO merchants (id, email, password_hash, name, chain_merchant_id)
VALUES ('mer_smoke', 'smoke@example.com', 'unused', 'Smoke', 'unused');
INSERT INTO webhook_endpoints (id, merchant_id, url, secret)
VALUES ('we_smoke', 'mer_smoke', 'http://$fixture:8080/webhook', 'smoke-secret');
INSERT INTO webhook_events (id, merchant_id, type, payload)
VALUES ('evt_smoke', 'mer_smoke', 'payment.succeeded', '{"id":"evt_smoke","type":"payment.succeeded","data":{}}');
INSERT INTO webhook_deliveries (id, event_id, endpoint_id)
VALUES ('whd_smoke', 'evt_smoke', 'we_smoke');
SQL

docker run -d --name "$worker" --network "$network" \
  -e DATABASE_URL="$database_url" -e WHITECHAIN_RPC_URL="http://$fixture:8080" \
  -e ALLOW_PRIVATE_WEBHOOK_URLS=true "$image" >/dev/null
wait_for "SELECT last_block FROM indexer_state WHERE key = 'payment_router'" 12373444
wait_for "SELECT status || ':' || attempts || ':' || last_status_code FROM webhook_deliveries" pending:1:503
docker stop --time 15 "$worker" >/dev/null
query -c "UPDATE webhook_deliveries SET next_attempt_at = now() WHERE id = 'whd_smoke'"
docker start "$worker" >/dev/null
wait_for "SELECT status || ':' || attempts || ':' || last_status_code FROM webhook_deliveries" succeeded:2:204
wait_for "SELECT last_block FROM indexer_state WHERE key = 'payment_router'" 12373444
echo "Worker checkpointed the chain and delivered the same queued event after restart."
