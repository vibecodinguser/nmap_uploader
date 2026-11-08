import { defineContentScript } from 'wxt/utils/define-content-script'
import { NotesCreateSidebar } from '@/lib/notes_sidebar'

export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    const sidebar = new NotesCreateSidebar()

    sidebar.start().catch((error: unknown) => {
      console.warn('[nmap_uploader] notes sidebar start failed:', error)
    })

    ctx.onInvalidated(() => {
      sidebar.stop()
    })
  },
})
