import { readUint32Le, toProcessingError } from './esri_types'

/** Возвращает число записей dBASE (стр. 25 PDF). */
export const countDbfRecords = (buffer: ArrayBuffer): number => {
  if (buffer.byteLength < 12) {
    throw toProcessingError('Файл .dbf слишком короткий')
  }

  const view = new DataView(buffer)
  return readUint32Le(view, 4)
}

/** Проверяет dBASE: одна запись на фигуру, порядок совпадает с .shp. */
export const validateDbfAgainstShp = (dbf: ArrayBuffer, shpRecordCount: number): void => {
  const dbfRecords = countDbfRecords(dbf)
  if (dbfRecords !== shpRecordCount) {
    throw toProcessingError(
      'Число записей .dbf ' +
        `(${dbfRecords}) не совпадает с числом фигур в .shp (${shpRecordCount})`,
    )
  }
}
