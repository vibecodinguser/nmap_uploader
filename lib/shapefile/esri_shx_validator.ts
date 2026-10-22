import { parseShpMainFile } from './esri_shp_parser'
import {
  ESRI_FILE_CODE,
  ESRI_FIRST_RECORD_OFFSET_WORDS,
  ESRI_HEADER_BYTES,
  readInt32Be,
  type ShpRecordSummary,
  toProcessingError,
} from './esri_types'

const ERR_SHX_HEADER_TOO_SHORT = [
  'Файл .shx слишком короткий:',
  'отсутствует 100-байтовый заголовок',
].join(' ')

const ERR_SHX_INDEX_ALIGNMENT = [
  'Размер индексных записей .shx',
  'должен быть кратен 8 байтам',
].join(' ')

const assertShxHeaderPresent = (shx: ArrayBuffer): void => {
  if (shx.byteLength < ESRI_HEADER_BYTES) {
    throw toProcessingError(ERR_SHX_HEADER_TOO_SHORT)
  }
}

const assertShxFileCode = (view: DataView): void => {
  const fileCode = readInt32Be(view, 0)
  if (fileCode !== ESRI_FILE_CODE) {
    throw toProcessingError(`Некорректный File Code в .shx: ожидался ${ESRI_FILE_CODE}`)
  }
}

const assertShxFileLength = (shx: ArrayBuffer, shxFileLengthWords: number): void => {
  const expectedShxBytes = shxFileLengthWords * 2
  if (shx.byteLength !== expectedShxBytes) {
    throw toProcessingError(
      'Длина .shx не совпадает с File Length в заголовке: ' +
        `${shx.byteLength} байт, ожидалось ${expectedShxBytes}`,
    )
  }
}

const assertShxIndexAlignment = (indexRecordBytes: number): void => {
  if (indexRecordBytes % 8 !== 0) {
    throw toProcessingError(ERR_SHX_INDEX_ALIGNMENT)
  }
}

const assertShxRecordCountMatches = (indexRecordCount: number, shpRecordCount: number): void => {
  if (indexRecordCount !== shpRecordCount) {
    throw toProcessingError(
      'Число записей .shx ' +
        `(${indexRecordCount}) не совпадает с числом записей .shp (${shpRecordCount})`,
    )
  }
}

const assertShxIndexRecordMatches = (
  index: number,
  indexOffsetWords: number,
  expectedOffsetWords: number,
  indexContentLengthWords: number,
  shpContentLengthWords: number,
): void => {
  if (indexOffsetWords === expectedOffsetWords) {
    if (indexContentLengthWords === shpContentLengthWords) {
      return
    }
    throw toProcessingError(`Content Length записи ${index + 1} в .shx не совпадает с .shp`)
  }

  throw toProcessingError(
    `Некорректное смещение записи ${index + 1} в .shx: ` +
      `ожидалось ${expectedOffsetWords}, получено ${indexOffsetWords}`,
  )
}

const validateShxIndexRecords = (shxView: DataView, shpRecords: ShpRecordSummary[]): void => {
  let expectedOffsetWords = ESRI_FIRST_RECORD_OFFSET_WORDS

  for (let index = 0; index < shpRecords.length; index += 1) {
    const shpRecord = shpRecords[index]
    const shxOffset = ESRI_HEADER_BYTES + index * 8
    const indexOffsetWords = readInt32Be(shxView, shxOffset)
    const indexContentLengthWords = readInt32Be(shxView, shxOffset + 4)

    assertShxIndexRecordMatches(
      index,
      indexOffsetWords,
      expectedOffsetWords,
      indexContentLengthWords,
      shpRecord.contentLengthWords,
    )

    expectedOffsetWords += 4 + shpRecord.contentLengthWords
  }
}

/** Парсит индекс .shx и сверяет его с .shp (Table 17, стр. 24 PDF). */
export const validateShxAgainstShp = (shp: ArrayBuffer, shx: ArrayBuffer): void => {
  assertShxHeaderPresent(shx)

  const shpSummary = parseShpMainFile(shp)
  const shxView = new DataView(shx)

  assertShxFileCode(shxView)

  const shxFileLengthWords = readInt32Be(shxView, 24)
  assertShxFileLength(shx, shxFileLengthWords)

  const indexRecordBytes = shx.byteLength - ESRI_HEADER_BYTES
  assertShxIndexAlignment(indexRecordBytes)

  const indexRecordCount = indexRecordBytes / 8
  assertShxRecordCountMatches(indexRecordCount, shpSummary.records.length)

  validateShxIndexRecords(shxView, shpSummary.records)
}
