#!/usr/bin/env bash
# Останавливает забытый dev-сервер WXT, который держит порт.
#
# Зачем: закрытие окна терминала на macOS не убивает дочерний `node`, и
# следующий `pnpm dev:chrome` падает с «Port 3000 is already in use» из-за
# `strictPort: true` в wxt.config.ts. Этот скрипт находит слушателя порта,
# убеждается, что это действительно WXT/Vite, и только потом останавливает.
#
# Запуск:
#   pnpm dev:stop            # порт 3000
#   pnpm dev:stop 3001       # другой порт
#
# Чужой процесс на порту не убивается: скрипт печатает его команду и
# завершается с кодом 1, чтобы решение осталось за человеком.

set -uo pipefail

PORT="${1:-3000}"

if ! command -v lsof >/dev/null 2>&1; then
  echo "✖ lsof не найден: без него не определить, кто держит порт $PORT" >&2
  exit 1
fi

PIDS="$(lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"

if [ -z "$PIDS" ]; then
  echo "✓ Порт $PORT свободен — останавливать нечего"
  exit 0
fi

STOPPED=0
REFUSED=0

for pid in $PIDS; do
  cmd="$(ps -o command= -p "$pid" 2>/dev/null || true)"
  if [ -z "$cmd" ]; then
    continue
  fi

  case "$cmd" in
    *wxt* | *vite*)
      echo "→ Останавливаю PID $pid: $cmd"
      kill "$pid" 2>/dev/null || true
      STOPPED=$((STOPPED + 1))
      ;;
    *)
      echo "✖ Порт $PORT держит не dev-сервер: PID $pid — $cmd" >&2
      echo "  Не трогаю. Остановите вручную, если это ожидаемо." >&2
      REFUSED=$((REFUSED + 1))
      ;;
  esac
done

# Даём процессам время закрыть сокет, прежде чем проверять результат.
for _ in 1 2 3 4 5; do
  if [ -z "$(lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)" ]; then
    break
  fi
  sleep 0.2
done

if [ -n "$(lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)" ]; then
  if [ "$REFUSED" -gt 0 ]; then
    echo "✖ Порт $PORT занят процессом, который скрипт не останавливает (см. выше)" >&2
    exit 1
  fi
  echo "✖ Порт $PORT всё ещё занят — процесс не завершился" >&2
  exit 1
fi

if [ "$REFUSED" -gt 0 ]; then
  exit 1
fi

echo "✓ Порт $PORT освобождён (остановлено процессов: $STOPPED)"
