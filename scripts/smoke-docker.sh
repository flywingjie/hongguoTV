#!/usr/bin/env bash
set -euo pipefail
image="${1:?Pass the image tag to verify}"
container="hongguotv-smoke-$$"
cleanup() {
  local status=$?
  if [[ $status != 0 ]]; then docker logs "$container" || true; fi
  docker rm -f "$container" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT
docker run --detach --name "$container" --init --read-only \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --health-interval 1s --health-start-period 1s \
  -p 127.0.0.1::8787 -e BRIDGE_TOKEN=ci-smoke-token "$image" >/dev/null
healthy=false
for ((i=0; i<40; i++)); do
  if [[ $(docker inspect --format '{{.State.Health.Status}}' "$container") == healthy ]]; then
    healthy=true
    break
  fi
  sleep 1
done
[[ "$healthy" == true ]]
port="$(docker port "$container" 8787/tcp)"
base="http://$port"
[[ $(curl --silent --output /dev/null --write-out '%{http_code}' "$base/health") == 401 ]]
curl --fail --silent --show-error -H 'Authorization: Bearer ci-smoke-token' "$base/health" |
  node -e 'let s=""; process.stdin.on("data",c=>s+=c).on("end",()=>{const d=JSON.parse(s); if(d.service!=="hongguotv"||d.apiVersion!==1||d.upstream!=="unverified")process.exit(1);});'
[[ $(docker exec "$container" id -u) != 0 ]]
echo "Container startup, non-root runtime, healthcheck, published port and authentication passed."
