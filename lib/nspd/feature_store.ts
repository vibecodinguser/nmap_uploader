/**
 * Хранилище перехваченных геометрий и атрибутов объектов с портала НСПД.
 */
import { extractCadastralNumber, type NspdRawObject } from '@/lib/nspd/extractor'

class NspdFeatureStore {
  private objectsByCadNum = new Map<string, NspdRawObject>()
  private recentObjects: NspdRawObject[] = []
  private maxRecent = 50

  public add(obj: NspdRawObject): void {
    const cadNum = obj.cadastralNumber ?? extractCadastralNumber(obj.properties)
    if (cadNum) {
      this.objectsByCadNum.set(cadNum, obj)
    }

    this.recentObjects.unshift(obj)
    if (this.recentObjects.length > this.maxRecent) {
      this.recentObjects.pop()
    }
  }

  public getByCadastralNumber(cadNum: string): NspdRawObject | undefined {
    return this.objectsByCadNum.get(cadNum)
  }

  public getRecent(): NspdRawObject[] {
    return [...this.recentObjects]
  }

  public clear(): void {
    this.objectsByCadNum.clear()
    this.recentObjects = []
  }

  /**
   * Ищет объекты для выгрузки: сначала по кадастровому номеру, если нет — последние перехваченные.
   */
  public resolveObjectsForUpload(cadNum?: string | null): NspdRawObject[] {
    if (cadNum) {
      const match = this.getByCadastralNumber(cadNum)
      if (match) return [match]
    }

    if (this.recentObjects.length > 0) {
      return this.recentObjects.filter((item) => Boolean(item.geometry))
    }

    return []
  }
}

export const nspdFeatureStore = new NspdFeatureStore()
