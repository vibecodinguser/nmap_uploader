import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { isYandexBrowser } from '@/lib/browser';
import {
  ensureStrokeRecolorEngine,
  teardownStrokeRecolorEngine,
} from '@/lib/stroke_recolor_engine';

const persistYandexBrowserFlag = async (): Promise<void> => {
  if (isYandexBrowser()) {
    await browser.storage.local.set({ is_yandex_browser: true });
  }
};

const reportPersistYandexBrowserFlagError = (error: unknown): void => {
  console.error('[nmap_uploader] persistYandexBrowserFlag failed:', error);
};

const startPersistYandexBrowserFlag = (): void => {
  const promise = persistYandexBrowserFlag();
  promise.catch(reportPersistYandexBrowserFlagError);
};

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  allFrames: true,
  runAt: 'document_start',
  main(ctx) {
    startPersistYandexBrowserFlag();
    ensureStrokeRecolorEngine();
    ctx.onInvalidated(teardownStrokeRecolorEngine);
  },
});
