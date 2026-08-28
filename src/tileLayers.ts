export type TileLayerId = string

export type MapLayerType = 'tile' | 'image'

export type TileLayerConfig = {
  id: TileLayerId
  label: string
  attribution: string
  url: string
  type?: MapLayerType
  maxZoom?: number
  maxNativeZoom?: number
}

export const tileLayers: readonly TileLayerConfig[] = [
  {
    id: 'osm',
    label: 'OpenStreetMap',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 23,
    maxNativeZoom: 19,
  },
  {
    id: 'satellite',
    label: 'Satellite',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 23,
    maxNativeZoom: 23,
  },
  {
    id: 'topo',
    label: 'Topo',
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://opentopomap.org/">OpenTopoMap</a>',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxZoom: 21,
    maxNativeZoom: 21,
  },
  {
    id: 'terrain',
    label: 'Terrain',
    attribution:
      'Map tiles by <a href="https://stamen.com/">Stamen Design</a>, under CC BY 3.0. Data by <a href="https://www.openstreetmap.org/">OpenStreetMap</a>, under ODbL.',
    url: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
    maxZoom: 18,
    maxNativeZoom: 18,
  },
  {
    id: 'cbrAerial',
    label: 'CBR Aerial Imaging',
    attribution:
      'Aerial imagery &copy; Australian Capital Territory and Aerometrex',
    url: 'https://tiles.arcgis.com/tiles/E5n4f1VY84i0xSjy/arcgis/rest/services/ACT_Aerial_Imagery_Current_3857/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 21,
    maxNativeZoom: 21,
  },
  {
  id: 'cbrAerial2019',
  label: 'CBR Aerial — 2019 50mm',
  type: 'image',
  attribution:
    'Aerial imagery © Australian Capital Territory',
  url:
    'https://data4.actmapi.act.gov.au/arcgis/rest/services/ACT_IMAGERY_MGA2020/2019_10_full_50mm/ImageServer',
  maxZoom: 23,
},
]
