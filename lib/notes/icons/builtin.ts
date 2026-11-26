/**
 * Встроенный набор иконок заметок.
 *
 * Это данные, а не React-компоненты: карта живёт в MAIN-мире без React и ей
 * нужна готовая SVG-картинка, а панель рисует те же фигуры своим компонентом.
 * Один реестр — одна и та же иконка в списке, в свойствах и на карте.
 *
 * Глифы взяты из lucide (лицензия ISC), viewBox 24×24.
 */

/** Фигура внутри иконки: тег SVG и его атрибуты. */
export type IconShape = { tag: string; attrs: Record<string, string> }

export type BuiltinIcon = {
  /**
   * Стабильный id. Попадает в манифест на Диске, поэтому переименование
   * сломало бы уже сохранённые заметки.
   */
  id: string
  shapes: IconShape[]
}

/** Размер холста глифов: все пути рассчитаны на 24×24. */
export const BUILTIN_ICON_VIEWBOX = 24

export const BUILTIN_ICONS: readonly BuiltinIcon[] = [
  {
    id: 'map-pin',
    shapes: [
      {
        tag: 'path',
        attrs: {
          d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0',
        },
      },
      { tag: 'circle', attrs: { cx: '12', cy: '10', r: '3' } },
    ],
  },
  {
    id: 'flag',
    shapes: [
      {
        tag: 'path',
        attrs: {
          d: 'M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528',
        },
      },
    ],
  },
  {
    id: 'home',
    shapes: [
      { tag: 'path', attrs: { d: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8' } },
      {
        tag: 'path',
        attrs: {
          d: 'M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
        },
      },
    ],
  },
  {
    id: 'building-2',
    shapes: [
      { tag: 'path', attrs: { d: 'M10 12h4' } },
      { tag: 'path', attrs: { d: 'M10 8h4' } },
      { tag: 'path', attrs: { d: 'M14 21v-3a2 2 0 0 0-4 0v3' } },
      {
        tag: 'path',
        attrs: { d: 'M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2' },
      },
      { tag: 'path', attrs: { d: 'M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16' } },
    ],
  },
  {
    id: 'landmark',
    shapes: [
      { tag: 'path', attrs: { d: 'M10 18v-7' } },
      {
        tag: 'path',
        attrs: {
          d: 'M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z',
        },
      },
      { tag: 'path', attrs: { d: 'M14 18v-7' } },
      { tag: 'path', attrs: { d: 'M18 18v-7' } },
      { tag: 'path', attrs: { d: 'M3 22h18' } },
      { tag: 'path', attrs: { d: 'M6 18v-7' } },
    ],
  },
  {
    id: 'store',
    shapes: [
      { tag: 'path', attrs: { d: 'M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5' } },
      {
        tag: 'path',
        attrs: {
          d: 'M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244',
        },
      },
      { tag: 'path', attrs: { d: 'M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05' } },
    ],
  },
  {
    id: 'hospital',
    shapes: [
      { tag: 'path', attrs: { d: 'M12 7v4' } },
      { tag: 'path', attrs: { d: 'M14 21v-3a2 2 0 0 0-4 0v3' } },
      { tag: 'path', attrs: { d: 'M14 9h-4' } },
      {
        tag: 'path',
        attrs: { d: 'M18 11h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2' },
      },
      { tag: 'path', attrs: { d: 'M18 21V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16' } },
    ],
  },
  {
    id: 'school',
    shapes: [
      { tag: 'path', attrs: { d: 'M14 21v-3a2 2 0 0 0-4 0v3' } },
      { tag: 'path', attrs: { d: 'M18 5v16' } },
      { tag: 'path', attrs: { d: 'm4 6 7.106-3.79a2 2 0 0 1 1.788 0L20 6' } },
      {
        tag: 'path',
        attrs: {
          d: 'm6 11-3.52 2.147a1 1 0 0 0-.48.854V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a1 1 0 0 0-.48-.853L18 11',
        },
      },
      { tag: 'path', attrs: { d: 'M6 5v16' } },
      { tag: 'circle', attrs: { cx: '12', cy: '9', r: '2' } },
    ],
  },
  {
    id: 'church',
    shapes: [
      { tag: 'path', attrs: { d: 'M10 9h4' } },
      { tag: 'path', attrs: { d: 'M12 7v5' } },
      { tag: 'path', attrs: { d: 'M14 21v-3a2 2 0 0 0-4 0v3' } },
      {
        tag: 'path',
        attrs: {
          d: 'm18 9 3.52 2.147a1 1 0 0 1 .48.854V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6.999a1 1 0 0 1 .48-.854L6 9',
        },
      },
      {
        tag: 'path',
        attrs: {
          d: 'M6 21V7a1 1 0 0 1 .376-.782l5-3.999a1 1 0 0 1 1.249.001l5 4A1 1 0 0 1 18 7v14',
        },
      },
    ],
  },
  {
    id: 'factory',
    shapes: [
      { tag: 'path', attrs: { d: 'M12 16h.01' } },
      { tag: 'path', attrs: { d: 'M16 16h.01' } },
      {
        tag: 'path',
        attrs: {
          d: 'M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z',
        },
      },
      { tag: 'path', attrs: { d: 'M8 16h.01' } },
    ],
  },
  {
    id: 'fuel',
    shapes: [
      {
        tag: 'path',
        attrs: { d: 'M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5' },
      },
      { tag: 'path', attrs: { d: 'M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16' } },
      { tag: 'path', attrs: { d: 'M2 21h13' } },
      { tag: 'path', attrs: { d: 'M3 9h11' } },
    ],
  },
  {
    id: 'parking-square',
    shapes: [
      { tag: 'rect', attrs: { width: '18', height: '18', x: '3', y: '3', rx: '2' } },
      { tag: 'path', attrs: { d: 'M9 17V7h4a3 3 0 0 1 0 6H9' } },
    ],
  },
  {
    id: 'utensils',
    shapes: [
      { tag: 'path', attrs: { d: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2' } },
      { tag: 'path', attrs: { d: 'M7 2v20' } },
      { tag: 'path', attrs: { d: 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7' } },
    ],
  },
  {
    id: 'hotel',
    shapes: [
      { tag: 'path', attrs: { d: 'M10 22v-6.57' } },
      { tag: 'path', attrs: { d: 'M12 11h.01' } },
      { tag: 'path', attrs: { d: 'M12 7h.01' } },
      { tag: 'path', attrs: { d: 'M14 15.43V22' } },
      { tag: 'path', attrs: { d: 'M15 16a5 5 0 0 0-6 0' } },
      { tag: 'path', attrs: { d: 'M16 11h.01' } },
      { tag: 'path', attrs: { d: 'M16 7h.01' } },
      { tag: 'path', attrs: { d: 'M8 11h.01' } },
      { tag: 'path', attrs: { d: 'M8 7h.01' } },
      { tag: 'rect', attrs: { x: '4', y: '2', width: '16', height: '20', rx: '2' } },
    ],
  },
  {
    id: 'tree-pine',
    shapes: [
      {
        tag: 'path',
        attrs: {
          d: 'm17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z',
        },
      },
      { tag: 'path', attrs: { d: 'M12 22v-3' } },
    ],
  },
  {
    id: 'trees',
    shapes: [
      {
        tag: 'path',
        attrs: { d: 'M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z' },
      },
      { tag: 'path', attrs: { d: 'M7 16v6' } },
      { tag: 'path', attrs: { d: 'M13 19v3' } },
      {
        tag: 'path',
        attrs: {
          d: 'M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5',
        },
      },
    ],
  },
  {
    id: 'mountain',
    shapes: [{ tag: 'path', attrs: { d: 'm8 3 4 8 5-5 5 15H2L8 3z' } }],
  },
  {
    id: 'waves',
    shapes: [
      {
        tag: 'path',
        attrs: {
          d: 'M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
        },
      },
      {
        tag: 'path',
        attrs: {
          d: 'M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
        },
      },
      {
        tag: 'path',
        attrs: {
          d: 'M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
        },
      },
    ],
  },
  {
    id: 'anchor',
    shapes: [
      { tag: 'path', attrs: { d: 'M12 6v16' } },
      { tag: 'path', attrs: { d: 'm19 13 2-1a9 9 0 0 1-18 0l2 1' } },
      { tag: 'path', attrs: { d: 'M9 11h6' } },
      { tag: 'circle', attrs: { cx: '12', cy: '4', r: '2' } },
    ],
  },
  {
    id: 'ship',
    shapes: [
      { tag: 'path', attrs: { d: 'M12 10.189V14' } },
      { tag: 'path', attrs: { d: 'M12 2v3' } },
      { tag: 'path', attrs: { d: 'M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6' } },
      {
        tag: 'path',
        attrs: {
          d: 'M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76',
        },
      },
      {
        tag: 'path',
        attrs: {
          d: 'M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
        },
      },
    ],
  },
  {
    id: 'plane',
    shapes: [
      {
        tag: 'path',
        attrs: {
          d: 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
        },
      },
    ],
  },
  {
    id: 'train-front',
    shapes: [
      { tag: 'path', attrs: { d: 'M8 3.1V7a4 4 0 0 0 8 0V3.1' } },
      { tag: 'path', attrs: { d: 'm9 15-1-1' } },
      { tag: 'path', attrs: { d: 'm15 15 1-1' } },
      { tag: 'path', attrs: { d: 'M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z' } },
      { tag: 'path', attrs: { d: 'm8 19-2 3' } },
      { tag: 'path', attrs: { d: 'm16 19 2 3' } },
    ],
  },
  {
    id: 'bus',
    shapes: [
      { tag: 'path', attrs: { d: 'M8 6v6' } },
      { tag: 'path', attrs: { d: 'M15 6v6' } },
      { tag: 'path', attrs: { d: 'M2 12h19.6' } },
      {
        tag: 'path',
        attrs: {
          d: 'M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3',
        },
      },
      { tag: 'circle', attrs: { cx: '7', cy: '18', r: '2' } },
      { tag: 'path', attrs: { d: 'M9 18h5' } },
      { tag: 'circle', attrs: { cx: '16', cy: '18', r: '2' } },
    ],
  },
  {
    id: 'car',
    shapes: [
      {
        tag: 'path',
        attrs: {
          d: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2',
        },
      },
      { tag: 'circle', attrs: { cx: '7', cy: '17', r: '2' } },
      { tag: 'path', attrs: { d: 'M9 17h6' } },
      { tag: 'circle', attrs: { cx: '17', cy: '17', r: '2' } },
    ],
  },
  {
    id: 'bike',
    shapes: [
      { tag: 'circle', attrs: { cx: '18.5', cy: '17.5', r: '3.5' } },
      { tag: 'circle', attrs: { cx: '5.5', cy: '17.5', r: '3.5' } },
      { tag: 'circle', attrs: { cx: '15', cy: '5', r: '1' } },
      { tag: 'path', attrs: { d: 'M12 17.5V14l-3-3 4-3 2 3h2' } },
    ],
  },
  {
    id: 'person-standing',
    shapes: [
      { tag: 'circle', attrs: { cx: '12', cy: '5', r: '1' } },
      { tag: 'path', attrs: { d: 'm9 20 3-6 3 6' } },
      { tag: 'path', attrs: { d: 'm6 8 6 2 6-2' } },
      { tag: 'path', attrs: { d: 'M12 10v4' } },
    ],
  },
  {
    id: 'camera',
    shapes: [
      {
        tag: 'path',
        attrs: {
          d: 'M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z',
        },
      },
      { tag: 'circle', attrs: { cx: '12', cy: '13', r: '3' } },
    ],
  },
  {
    id: 'cross',
    shapes: [
      {
        tag: 'path',
        attrs: {
          d: 'M4 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a1 1 0 0 1 1 1v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4a1 1 0 0 1 1-1h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-4a1 1 0 0 1-1-1V4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4a1 1 0 0 1-1 1z',
        },
      },
    ],
  },
  {
    id: 'star',
    shapes: [
      {
        tag: 'path',
        attrs: {
          d: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z',
        },
      },
    ],
  },
  {
    id: 'triangle-alert',
    shapes: [
      {
        tag: 'path',
        attrs: { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' },
      },
      { tag: 'path', attrs: { d: 'M12 9v4' } },
      { tag: 'path', attrs: { d: 'M12 17h.01' } },
    ],
  },
  {
    id: 'info',
    shapes: [
      { tag: 'circle', attrs: { cx: '12', cy: '12', r: '10' } },
      { tag: 'path', attrs: { d: 'M12 16v-4' } },
      { tag: 'path', attrs: { d: 'M12 8h.01' } },
    ],
  },
  {
    id: 'construction',
    shapes: [
      { tag: 'rect', attrs: { x: '2', y: '6', width: '20', height: '8', rx: '1' } },
      { tag: 'path', attrs: { d: 'M17 14v7' } },
      { tag: 'path', attrs: { d: 'M7 14v7' } },
      { tag: 'path', attrs: { d: 'M17 3v3' } },
      { tag: 'path', attrs: { d: 'M7 3v3' } },
      { tag: 'path', attrs: { d: 'M10 14 2.3 6.3' } },
      { tag: 'path', attrs: { d: 'm14 6 7.7 7.7' } },
      { tag: 'path', attrs: { d: 'm8 6 8 8' } },
    ],
  },
  {
    id: 'droplets',
    shapes: [
      {
        tag: 'path',
        attrs: {
          d: 'M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z',
        },
      },
      {
        tag: 'path',
        attrs: {
          d: 'M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97',
        },
      },
    ],
  },
  {
    id: 'zap',
    shapes: [
      {
        tag: 'path',
        attrs: {
          d: 'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z',
        },
      },
    ],
  },
  {
    id: 'radio-tower',
    shapes: [
      { tag: 'path', attrs: { d: 'M4.9 16.1C1 12.2 1 5.8 4.9 1.9' } },
      { tag: 'path', attrs: { d: 'M7.8 4.7a6.14 6.14 0 0 0-.8 7.5' } },
      { tag: 'circle', attrs: { cx: '12', cy: '9', r: '2' } },
      { tag: 'path', attrs: { d: 'M16.2 4.8c2 2 2.26 5.11.8 7.47' } },
      { tag: 'path', attrs: { d: 'M19.1 1.9a9.96 9.96 0 0 1 0 14.1' } },
      { tag: 'path', attrs: { d: 'M9.5 18h5' } },
      { tag: 'path', attrs: { d: 'm8 22 4-11 4 11' } },
    ],
  },
  {
    id: 'route',
    shapes: [
      { tag: 'circle', attrs: { cx: '6', cy: '19', r: '3' } },
      { tag: 'path', attrs: { d: 'M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15' } },
      { tag: 'circle', attrs: { cx: '18', cy: '5', r: '3' } },
    ],
  },
  {
    id: 'hammer',
    shapes: [
      { tag: 'path', attrs: { d: 'm15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9' } },
      { tag: 'path', attrs: { d: 'm18 15 4-4' } },
      {
        tag: 'path',
        attrs: {
          d: 'm21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5',
        },
      },
    ],
  },
  {
    id: 'wrench',
    shapes: [
      {
        tag: 'path',
        attrs: {
          d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z',
        },
      },
    ],
  },
  {
    id: 'shield',
    shapes: [
      {
        tag: 'path',
        attrs: {
          d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
        },
      },
    ],
  },
  {
    id: 'leaf',
    shapes: [
      {
        tag: 'path',
        attrs: {
          d: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z',
        },
      },
      { tag: 'path', attrs: { d: 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12' } },
    ],
  },
  {
    id: 'fish',
    shapes: [
      {
        tag: 'path',
        attrs: {
          d: 'M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z',
        },
      },
      { tag: 'path', attrs: { d: 'M18 12v.5' } },
      { tag: 'path', attrs: { d: 'M16 17.93a9.77 9.77 0 0 1 0-11.86' } },
      {
        tag: 'path',
        attrs: {
          d: 'M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33',
        },
      },
      {
        tag: 'path',
        attrs: { d: 'M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4' },
      },
      {
        tag: 'path',
        attrs: { d: 'm16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98' },
      },
    ],
  },
]

/** id всех встроенных иконок — для проверки значения из манифеста. */
const BUILTIN_ICON_IDS: readonly string[] = BUILTIN_ICONS.map((icon) => icon.id)

export const isBuiltinIconId = (value: unknown): value is string =>
  typeof value === 'string' && BUILTIN_ICON_IDS.includes(value)

export const findBuiltinIcon = (id: string): BuiltinIcon | null =>
  BUILTIN_ICONS.find((icon) => icon.id === id) ?? null
