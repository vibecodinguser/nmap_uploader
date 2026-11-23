#!/usr/bin/env bash
# Публикация сайта справки в ветку gh-pages без GitHub Actions.
#
# Зачем: аккаунт заблокирован для запуска Actions из-за биллинговой проблемы,
# а сайту надо выходить в интернет. Скрипт собирает docs-site и складывает
# готовую статику в отдельную ветку gh-pages, из которой GitHub Pages
# раздаёт файлы (Settings → Pages → Source = "Deploy from a branch").
#
# Запуск из любой папки:
#   docs-site/scripts/publish-gh-pages.sh
#
# Если ветки gh-pages ещё нет, она создаётся сиротской (без общей истории
# с master). Повторные запуски дописывают коммиты к существующей ветке.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="$REPO_ROOT/docs-site"
DIST_DIR="$SITE_DIR/.vitepress/dist"
BRANCH="gh-pages"

if [ ! -x "$SITE_DIR/node_modules/.bin/vitepress" ]; then
  echo "✖ Не найден vitepress. Сначала установите зависимости в docs-site:" >&2
  echo "  cd docs-site && pnpm install" >&2
  exit 1
fi

echo "→ Сборка сайта"
(cd "$SITE_DIR" && ./node_modules/.bin/vitepress build)

if [ ! -f "$DIST_DIR/index.html" ]; then
  echo "✖ Сборка не дала index.html в $DIST_DIR" >&2
  exit 1
fi

# Отдельный git-каталог внутри dist: рабочее дерево — сам dist, индексы и
# refs — в .git-publish. Функция не даёт GIT_DIR утечь в git-команды,
# которые должны работать с репозиторием расширения.
publish_git() {
  git --git-dir="$DIST_DIR/.git-publish" --work-tree="$DIST_DIR" "$@"
}

rm -rf "$DIST_DIR/.git-publish"
publish_git init -q --initial-branch="$BRANCH"
publish_git config user.name "$(git -C "$REPO_ROOT" config user.name)"
publish_git config user.email "$(git -C "$REPO_ROOT" config user.email)"

# dist содержит .git-publish, его в публикацию не берём.
printf '.git-publish/\n' > "$DIST_DIR/.gitignore"

HAS_ORIGIN=0
ORIGIN_URL="$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null || true)"
if [ -n "$ORIGIN_URL" ]; then
  HAS_ORIGIN=1
  publish_git remote add origin "$ORIGIN_URL"

  # Подтягиваем историю уже опубликованной ветки, если она есть.
  if publish_git fetch -q origin "$BRANCH" 2>/dev/null; then
    publish_git reset -q --soft FETCH_HEAD
    # Оставляем в индексе только то, что реально лежит в dist: прошлые
    # публикации могли содержать лишние файлы (например, служебный
    # .git-publish), которых в новой сборке уже нет.
    publish_git rm -r -q --cached --ignore-unmatch .
  fi
else
  echo "⚠ У репозитория нет remote origin — ветка $BRANCH останется локальной" >&2
fi

# .nojekyll обязателен: без него GitHub Pages выбрасывает папки с "_",
# и стили из assets/ перестают находиться. VitePress кладёт его из public/,
# но повторная проверка не помешает.
touch "$DIST_DIR/.nojekyll"

publish_git add -A --force -- ':!.git-publish'
publish_git add -f .gitignore .nojekyll

if publish_git diff --cached --quiet; then
  echo "✓ Изменений нет — публикация не нужна"
  exit 0
fi

publish_git commit -q -m "docs(site): публикация $(date -u '+%Y-%m-%d %H:%M UTC')"

if [ "$HAS_ORIGIN" = "1" ]; then
  echo "→ Отправка в origin/$BRANCH"
  publish_git push -q origin "$BRANCH"
  echo "✓ Опубликовано: https://vibecodinguser.github.io/yamapper/"
else
  echo "✓ Коммит создан локально, отправка пропущена"
fi
