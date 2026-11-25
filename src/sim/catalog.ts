import { R } from './layout'
import type { PropDef } from './types'

const ALL = [0, 1, 2, 3, 4, 5, 6] as const

/**
 * Every thing the jelly can become or steal. `value > 0` = loot.
 * Sizes: XS swallow only, S/M swallow and hide, L hide only.
 */
export const CATALOG = {
  saksi: { name: 'saksı', size: 'M', homes: ALL, radius: 0.32, height: 1.37, value: 0 },
  kaktus: { name: 'kaktüs', size: 'M', homes: ALL, radius: 0.35, height: 0.66, value: 0 },
  minikKaktus: { name: 'minik kaktüs', size: 'S', homes: ALL, radius: 0.22, height: 0.44, value: 0 },
  lambader: { name: 'lambader', size: 'L', homes: [R.salon, R.yatak, R.calisma, R.cocuk], radius: 0.33, height: 2.0, value: 0 },
  masaLambasi: { name: 'masa lambası', size: 'S', homes: [R.yatak, R.calisma, R.cocuk, R.salon], radius: 0.3, height: 0.82, value: 0 },
  sandalye: { name: 'sandalye', size: 'M', homes: [R.mutfak, R.yemek, R.calisma, R.cocuk], radius: 0.34, height: 1.0, value: 0 },
  tabure: { name: 'tabure', size: 'S', homes: [R.mutfak, R.yemek, R.cocuk], radius: 0.3, height: 0.4, value: 0 },
  cop: { name: 'çöp kovası', size: 'M', homes: ALL, radius: 0.26, height: 0.9, value: 0 },
  kutu: { name: 'karton kutu', size: 'S', homes: [R.cocuk, R.calisma, R.yemek, R.yatak], radius: 0.26, height: 0.59, value: 0 },
  kitap: { name: 'kitap yığını', size: 'S', homes: [R.salon, R.calisma, R.cocuk, R.yatak], radius: 0.3, height: 0.4, value: 0 },
  kitaplik: { name: 'kitaplık', size: 'M', homes: [R.salon, R.calisma, R.cocuk, R.yatak], radius: 0.42, height: 0.84, value: 0 },
  puf: { name: 'puf', size: 'M', homes: [R.salon, R.yatak], radius: 0.45, height: 0.48, value: 0 },
  yastik: { name: 'yastık', size: 'S', homes: [R.salon, R.yatak, R.cocuk], radius: 0.26, height: 0.16, value: 0 },
  hoparlor: { name: 'hoparlör', size: 'M', homes: [R.salon, R.cocuk, R.calisma], radius: 0.2, height: 1.34, value: 0 },
  komodin: { name: 'komodin', size: 'M', homes: [R.yatak, R.calisma, R.salon], radius: 0.4, height: 0.8, value: 0 },
  camasir: { name: 'çamaşır makinesi', size: 'M', homes: [R.banyo, R.mutfak], radius: 0.42, height: 0.99, value: 0 },
  askilik: { name: 'askılık', size: 'L', homes: [R.yemek, R.yatak, R.salon], radius: 0.3, height: 1.62, value: 0 },
  kova: { name: 'kova', size: 'S', homes: [R.mutfak, R.banyo], radius: 0.28, height: 0.5, value: 0 },
  top: { name: 'top', size: 'S', homes: [R.cocuk, R.salon, R.yemek], radius: 0.3, height: 0.6, value: 0 },
  salatalik: { name: 'salatalık', size: 'S', homes: [R.mutfak], radius: 0.3, height: 0.3, value: 0 },
  tost: { name: 'tost makinesi', size: 'S', homes: [R.mutfak], radius: 0.22, height: 0.27, value: 0 },
  blender: { name: 'blender', size: 'S', homes: [R.mutfak], radius: 0.18, height: 0.48, value: 0 },
  cerceve: { name: 'fotoğraf çerçevesi', size: 'S', homes: [R.salon, R.calisma, R.yatak, R.yemek], radius: 0.22, height: 0.5, value: 0 },
  // Loot.
  vazo: { name: 'altın vazo', size: 'M', homes: [R.salon, R.yatak, R.yemek], radius: 0.42, height: 1.2, value: 100 },
  ayicik: { name: 'oyuncak ayı', size: 'S', homes: [R.cocuk, R.yatak], radius: 0.36, height: 0.95, value: 30 },
  kavanoz: { name: 'kurabiye kavanozu', size: 'S', homes: [R.mutfak], radius: 0.3, height: 0.55, value: 25 },
  yuzuk: { name: 'altın yüzük', size: 'XS', homes: ALL, radius: 0.18, height: 0.2, value: 50 },
  radyo: { name: 'antika radyo', size: 'S', homes: [R.salon, R.calisma, R.mutfak], radius: 0.34, height: 0.48, value: 40 },
  laptop: { name: 'dizüstü bilgisayar', size: 'S', homes: [R.calisma, R.cocuk], radius: 0.3, height: 0.34, value: 60 },
  tv: { name: 'eski televizyon', size: 'M', homes: [R.salon, R.calisma, R.yatak], radius: 0.45, height: 0.57, value: 80 },
  kupa: { name: 'altın kupa', size: 'S', homes: [R.calisma, R.salon], radius: 0.25, height: 0.7, value: 90 },
  kumbara: { name: 'domuz kumbara', size: 'S', homes: [R.cocuk], radius: 0.28, height: 0.45, value: 45 },
  mucevher: { name: 'mücevher kutusu', size: 'S', homes: [R.yatak], radius: 0.26, height: 0.32, value: 70 },
  ordek: { name: 'lastik ördek', size: 'XS', homes: [R.banyo], radius: 0.18, height: 0.3, value: 15 },
} as const satisfies Record<string, PropDef>

export type PropKind = keyof typeof CATALOG

export const PROP_DEFS: Record<PropKind, PropDef> = CATALOG

export interface PropStart {
  readonly kind: PropKind
  readonly x: number
  readonly z: number
  readonly rot?: number
}

const L = Math.PI / 2
const Rt = -Math.PI / 2
const F = Math.PI

export const PROP_START: readonly PropStart[] = [
  // Kitchen
  { kind: 'sandalye', x: -11.5, z: -6.35 },
  { kind: 'sandalye', x: -11.5, z: -3.65, rot: F },
  { kind: 'sandalye', x: -12.85, z: -5.0, rot: L },
  { kind: 'sandalye', x: -10.15, z: -5.0, rot: Rt },
  { kind: 'kavanoz', x: -12.4, z: -9.55 },
  { kind: 'salatalik', x: -15.6, z: -9.5, rot: 0.4 },
  { kind: 'tost', x: -14.6, z: -9.5 },
  { kind: 'blender', x: -13.7, z: -9.5 },
  { kind: 'cop', x: -6.8, z: -9.9 },
  { kind: 'kova', x: -16.3, z: -7.2 },
  { kind: 'saksi', x: -6.8, z: -0.9 },
  { kind: 'tabure', x: -8.0, z: -7.5 },
  { kind: 'radyo', x: -9.6, z: -10.3 },
  // Living room
  { kind: 'saksi', x: -5.4, z: -7.6 },
  { kind: 'lambader', x: 5.3, z: -10.3 },
  { kind: 'puf', x: 2.4, z: -5.0 },
  { kind: 'hoparlor', x: 1.4, z: -10.6 },
  { kind: 'kitap', x: -2.6, z: -4.2 },
  { kind: 'top', x: -3.6, z: -1.5 },
  { kind: 'kaktus', x: 5.2, z: -0.9 },
  { kind: 'yastik', x: -2.0, z: -5.4 },
  { kind: 'yuzuk', x: -5.15, z: -6.95 },
  { kind: 'kitaplik', x: 4.9, z: -6.6, rot: Rt },
  // Bedroom
  { kind: 'mucevher', x: 7.2, z: -9.6 },
  { kind: 'lambader', x: 16.3, z: -10.3 },
  { kind: 'saksi', x: 6.8, z: -0.9 },
  { kind: 'puf', x: 11.5, z: -7.6 },
  { kind: 'yastik', x: 9.2, z: -6.4 },
  { kind: 'cop', x: 16.3, z: -0.9 },
  { kind: 'vazo', x: 15.4, z: -3.6 },
  { kind: 'komodin', x: 13.9, z: -1.3 },
  { kind: 'askilik', x: 6.9, z: -7.2 },
  { kind: 'masaLambasi', x: 8.2, z: -4.0 },
  // Bathroom
  { kind: 'camasir', x: -10.0, z: 10.2 },
  { kind: 'kova', x: -15.6, z: 6.0 },
  { kind: 'ordek', x: -15.4, z: 1.9 },
  { kind: 'cop', x: -9.8, z: 1.0 },
  { kind: 'minikKaktus', x: -12.6, z: 10.2 },
  // Dining room
  { kind: 'sandalye', x: -3.8, z: 3.15 },
  { kind: 'sandalye', x: -2.2, z: 3.15 },
  { kind: 'sandalye', x: -3.8, z: 5.85, rot: F },
  { kind: 'sandalye', x: -2.2, z: 5.85, rot: F },
  { kind: 'sandalye', x: -4.85, z: 4.5, rot: L },
  { kind: 'sandalye', x: -1.15, z: 4.5, rot: Rt },
  { kind: 'saksi', x: 2.4, z: 0.9 },
  { kind: 'saksi', x: -8.3, z: 10.2 },
  { kind: 'askilik', x: 2.4, z: 10.2 },
  { kind: 'cerceve', x: -7.2, z: 0.6 },
  { kind: 'kutu', x: 0.6, z: 9.6 },
  // Kids' room
  { kind: 'ayicik', x: 5.0, z: 3.2 },
  { kind: 'kumbara', x: 3.8, z: 9.9 },
  { kind: 'top', x: 7.6, z: 7.0 },
  { kind: 'kutu', x: 9.3, z: 10.2 },
  { kind: 'kutu', x: 8.7, z: 10.3 },
  { kind: 'tabure', x: 6.3, z: 9.7, rot: F },
  { kind: 'masaLambasi', x: 9.4, z: 3.3 },
  { kind: 'kitap', x: 4.6, z: 1.4 },
  { kind: 'hoparlor', x: 3.5, z: 7.6 },
  // Study
  { kind: 'laptop', x: 13.6, z: 1.6 },
  { kind: 'kupa', x: 16.3, z: 9.9 },
  { kind: 'tv', x: 14.3, z: 10.0, rot: F },
  { kind: 'lambader', x: 10.6, z: 0.8 },
  { kind: 'kutu', x: 11.0, z: 4.3 },
  { kind: 'kutu', x: 11.6, z: 4.0 },
  { kind: 'saksi', x: 16.4, z: 10.3 },
  { kind: 'cerceve', x: 15.5, z: 7.4 },
  { kind: 'komodin', x: 16.4, z: 1.0 },
  { kind: 'kitap', x: 12.6, z: 6.4 },
]
