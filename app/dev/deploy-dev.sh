#!/usr/bin/env bash
# Build Kaoru Home and push it to the dev01 test instance (container
# hass-dev, config in the docker volume hass-dev-config).
#   ./deploy-dev.sh            build + copy the bundle (reload the page after)
#   ./deploy-dev.sh --restart  also copy sim.yaml and restart Home Assistant
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
container="${HASS_DEV_CONTAINER:-hass-dev}"

(cd "$repo/app" && npm run --silent build)

docker exec "$container" mkdir -p /config/www/kaoru-home
docker cp "$repo/www/kaoru-home/." "$container:/config/www/kaoru-home/"

if [[ "${1:-}" == "--restart" ]]; then
  docker cp "$here/sim.yaml" "$container:/config/packages/zz_kh_sim.yaml"
  docker restart "$container" >/dev/null
  echo "restarted $container"
fi
echo "deployed to $container"
