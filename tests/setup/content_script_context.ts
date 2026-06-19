import { vi } from 'vitest';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';

type TestContentScriptContext = ContentScriptContext & {
  runInvalidated: () => void;
};

/** Минимальный mock ContentScriptContext для вызова main() content scripts. */
export function createContentScriptContext(): TestContentScriptContext {
  const cleanupFns: Array<() => void> = [];

  return {
    id: 'test-content-script',
    contentScriptName: 'test',
    isInvalid: false,
    isValid: true,
    onInvalidated: (fn: () => void) => {
      cleanupFns.push(fn);
    },
    runInvalidated: () => {
      for (const fn of cleanupFns) {
        fn();
      }
      cleanupFns.length = 0;
    },
  } as unknown as TestContentScriptContext;
}

class WindowTopMock {
  constructor(private readonly originalTop: Window | null) {
    Object.defineProperty(window, 'top', {
      configurable: true,
      value: {},
    });
  }

  restoreTopFrame = (): void => {
    Object.defineProperty(window, 'top', {
      configurable: true,
      value: this.originalTop,
    });
  };
}

/** Имитирует iframe: content script не должен работать в top frame. */
export function mockIframeWindow(): () => void {
  const mock = new WindowTopMock(window.top);
  return mock.restoreTopFrame;
}

class ParentPostMessageSpy {
  readonly messages: unknown[] = [];
  readonly postMessage: ReturnType<typeof vi.fn>;

  constructor(private readonly originalParent: Window) {
    this.postMessage = vi.fn(this.captureMessage);

    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage: this.postMessage },
    });
  }

  captureMessage = (message: unknown): void => {
    this.messages.push(message);
  };

  restoreParentFrame = (): void => {
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: this.originalParent,
    });
  };
}

/** Смотрит за postMessage родительского окна. */
export function spyParentPostMessage(): {
  messages: unknown[];
  restore: () => void;
} {
  const spy = new ParentPostMessageSpy(window.parent);
  return {
    messages: spy.messages,
    restore: spy.restoreParentFrame,
  };
}
