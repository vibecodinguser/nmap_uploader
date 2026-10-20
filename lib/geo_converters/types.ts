import type { ProcessResult } from '@/lib/nmap_index'

export type GeoConvertError = {
  readonly code: string
  readonly message: string
  readonly details?: unknown
}

export type GeoConvertResult =
  | { readonly ok: true; readonly value: ProcessResult }
  | { readonly ok: false; readonly error: GeoConvertError }

export type ProcessGeoFileInput = {
  readonly buffer: ArrayBuffer
  readonly fileName: string
}
