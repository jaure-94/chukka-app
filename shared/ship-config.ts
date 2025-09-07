// Static ship names configuration
export const SHIP_NAMES = [
  'LIBERTY',
  'VISTA', 
  'FREEDOM',
  'CONQUEST',
  'GLORY',
  'ELATION',
  'PRIDE',
  'MARDI GRAS',
  'CELEBRATION',
  'HORIZON',
  'DREAM',
  'SUNRISE',
  'VENEZIA',
  'MAGIC',
  'PANORAMA',
  'SUNSHINE',
  'SPLENDOUR',
  'LEGEND',
  'JUBILEE',
  'MIRACLE',
  'FIRENZE',
  'LUMINOSA',
  'RADIANCE',
  'SENSATION'
] as const;

export type ShipName = typeof SHIP_NAMES[number];

// Default ship name mappings for backward compatibility
export const DEFAULT_SHIP_NAMES: Record<string, ShipName> = {
  'ship-a': 'LIBERTY',
  'ship-b': 'VISTA', 
  'ship-c': 'FREEDOM'
};