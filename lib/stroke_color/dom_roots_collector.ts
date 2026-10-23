/**
 * Сбор корней документа, включая Shadow DOM и доступные iframe.
 */
export const collectRoots = (root: ParentNode): ParentNode[] => {
  const roots: ParentNode[] = [root]

  const elements =
    root instanceof Document
      ? root.querySelectorAll('*')
      : root instanceof Element
        ? root.querySelectorAll('*')
        : []

  for (const element of elements) {
    if (element.shadowRoot) {
      roots.push(element.shadowRoot)
      roots.push(...collectRoots(element.shadowRoot))
    }
  }

  if (root instanceof Document) {
    for (const iframe of root.querySelectorAll('iframe')) {
      try {
        const frameDocument = iframe.contentDocument
        if (!frameDocument) continue
        roots.push(frameDocument)
        roots.push(...collectRoots(frameDocument))
      } catch {
        // cross-origin iframe
      }
    }
  }

  return roots
}
