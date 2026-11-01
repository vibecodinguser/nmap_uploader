/**
 * Хранилище перехваченных геометрий и атрибутов объектов с портала НСПД.
 */
import {
  extractCadastralNumber,
  extractRegistryNumber,
  type NspdRawObject,
} from '@/lib/nspd/extractor'

class NspdFeatureStore {
  private objectsByIdentifier = new Map<string, NspdRawObject[]>()
  private recentObjects: NspdRawObject[] = []
  private maxRecent = 50

  public add(obj: NspdRawObject): void {
    const cadNum = obj.cadastralNumber ?? extractCadastralNumber(obj.properties)
    const regNum = obj.registryNumber ?? extractRegistryNumber(obj.properties)

    const registerKey = (key: string) => {
      const normalized = key.trim()
      const noSpaces = normalized.replace(/\s+/g, '')

      for (const k of [normalized, noSpaces]) {
        const list = this.objectsByIdentifier.get(k) ?? []
        if (!list.includes(obj)) {
          list.push(obj)
        }
        this.objectsByIdentifier.set(k, list)
      }
    }

    if (cadNum) registerKey(cadNum)
    if (regNum) registerKey(regNum)

    this.recentObjects.unshift(obj)
    if (this.recentObjects.length > this.maxRecent) {
      this.recentObjects.pop()
    }
  }

  public getByIdentifier(identifier: string): NspdRawObject[] {
    const clean = identifier.trim()
    const noSpaces = clean.replace(/\s+/g, '')
    return this.objectsByIdentifier.get(clean) ?? this.objectsByIdentifier.get(noSpaces) ?? []
  }

  public getByCadastralNumber(cadNum: string): NspdRawObject | undefined {
    return this.getByIdentifier(cadNum)[0]
  }

  public getByRegistryNumber(regNum: string): NspdRawObject | undefined {
    return this.getByIdentifier(regNum)[0]
  }

  public getRecent(): NspdRawObject[] {
    return [...this.recentObjects]
  }

  public clear(): void {
    this.objectsByIdentifier.clear()
    this.recentObjects = []
  }

  /**
   * Ищет объекты для выгрузки: строго выбранный контур по кадастровому/реестровому номеру
   * либо единственный последний выбранный объект.
   */
  public resolveObjectsForUpload(identifier?: string | null): NspdRawObject[] {
    if (identifier) {
      const matches = this.getByIdentifier(identifier).filter((item) => Boolean(item.geometry))
      if (matches.length > 0) {
        return matches
      }

      const clean = identifier.trim().replace(/\s+/g, '')
      const found = this.recentObjects.find((item) => {
        if (!item.geometry) return false
        const cad = (item.cadastralNumber ?? extractCadastralNumber(item.properties))?.replace(
          /\s+/g,
          '',
        )
        const reg = (item.registryNumber ?? extractRegistryNumber(item.properties))?.replace(
          /\s+/g,
          '',
        )
        return cad === clean || reg === clean
      })
      if (found) {
        return [found]
      }

      return []
    }

    const recent = this.recentObjects.find((item) => Boolean(item.geometry))
    if (recent) {
      const cadNum = recent.cadastralNumber ?? extractCadastralNumber(recent.properties)
      const regNum = recent.registryNumber ?? extractRegistryNumber(recent.properties)
      const id = cadNum ?? regNum
      if (id) {
        const matches = this.getByIdentifier(id).filter((item) => Boolean(item.geometry))
        if (matches.length > 0) return matches
      }
      return [recent]
    }

    return []
  }
}

export const nspdFeatureStore = new NspdFeatureStore()
