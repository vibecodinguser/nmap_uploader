import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

// Пустая тема: наследуем стандартную, чтобы потом точечно добавлять стили
// под фирменный вид расширения, не копируя тему целиком.
export default {
  extends: DefaultTheme,
} satisfies Theme
