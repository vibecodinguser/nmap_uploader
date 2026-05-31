/** Возвращает true, если действие можно выполнять; иначе вызывает onRequireAuth. */
export const requireAuthBeforeAction = ({
  isLoggedIn,
  onRequireAuth,
}: {
  isLoggedIn: boolean
  onRequireAuth: () => void
}): boolean => {
  if (isLoggedIn) return true
  onRequireAuth()
  return false
}
