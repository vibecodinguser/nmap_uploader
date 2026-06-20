import assert from 'node:assert/strict';
import { ensureStorageFolders, verifyDiskAccess } from '@/lib/yandex/client';

export async function verifyYandexAccess(): Promise<void> {
  const token = process.env.YANDEX_TEST_TOKEN;
  if (token === undefined) {
    assert.strictEqual(process.env.YANDEX_TEST_TOKEN, undefined);
  } else {
    await verifyDiskAccess({ token });
    await ensureStorageFolders({ token });
  }
}
