import { describe, it } from 'vitest'
import { verifyYandexAccess } from '@/tests/smoke/yandex_live'

function yandexLiveSmokeSuite(): void {
  it('проверяет доступ к API или пропускается без YANDEX_TEST_TOKEN', verifyYandexAccess)
}

describe('Yandex live smoke', yandexLiveSmokeSuite)
