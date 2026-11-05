#!/usr/bin/env bash
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

case "${1:-}" in
  '') docker_cmd=(docker) ;;
  --sudo) docker_cmd=(sudo docker) ;;
  *) echo 'Usage: ./start.sh [--sudo]'; exit 2 ;;
esac

command -v docker >/dev/null || { echo 'Install Docker Engine and Docker Compose v2 first.' >&2; exit 1; }
command -v python3 >/dev/null || { echo 'Python 3 is needed to prepare configuration and check readiness.' >&2; exit 1; }
python3 scripts/configure_env.py

if ! "${docker_cmd[@]}" info >/dev/null 2>&1; then
  echo 'Docker is unavailable from this terminal. Ensure the Docker daemon is running.' >&2
  if [[ "${1:-}" != '--sudo' ]]; then
    echo 'If Docker requires administrator access, run: ./start.sh --sudo' >&2
  fi
  exit 1
fi
"${docker_cmd[@]}" compose version >/dev/null
"${docker_cmd[@]}" compose config --quiet
"${docker_cmd[@]}" compose up --build -d --wait --wait-timeout 180

python3 - <<'PY'
import time
import urllib.error
import urllib.request
url = 'http://localhost:5173/api/health'
for attempt in range(30):
    try:
        with urllib.request.urlopen(url, timeout=3) as response:
            if response.status == 200:
                print('Folio is ready at http://localhost:5173')
                break
    except (urllib.error.URLError, TimeoutError):
        pass
    time.sleep(2)
else:
    raise SystemExit('The site is not ready. Inspect: docker compose logs backend frontend')
PY

url='http://localhost:5173'
if command -v xdg-open >/dev/null; then
  xdg-open "$url" >/dev/null 2>&1 &
elif [[ "$(uname -s)" == Darwin ]]; then
  open "$url"
else
  echo "Open $url in your browser."
fi
printf '\nCreate an account to start. Services keep running until: docker compose down\n'
