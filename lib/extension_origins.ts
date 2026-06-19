export const NMAPS_ORIGIN = 'https://n.maps.yandex.ru' as const;
export const NAKARTE_ORIGIN = 'https://nakarte.me' as const;

export const isNmapsOrigin = (origin: string): boolean => origin === NMAPS_ORIGIN;

export const isNakarteOrigin = (origin: string): boolean => origin === NAKARTE_ORIGIN;
