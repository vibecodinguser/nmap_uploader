/**
 * Адаптер вызовов фоновых задач (Background Task Runner).
 */
export const logBackgroundTaskFailure = (label: string, error: unknown): void => {
  console.warn(`[nmap_uploader] ${label} failed:`, error)
}

export const executeBackgroundTask = async (
  task: Promise<unknown>,
  label: string,
): Promise<void> => {
  try {
    await task
  } catch (error: unknown) {
    logBackgroundTaskFailure(label, error)
  }
}

export const runBackgroundTask = (task: Promise<unknown>, label: string): void => {
  const execution = executeBackgroundTask(task, label)
  void execution
}
