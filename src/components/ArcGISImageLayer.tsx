import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { imageMapLayer } from 'esri-leaflet'
// import L from 'leaflet'
// import 'esri-leaflet'

type ArcGISImageLayerProps = {
  url: string
  attribution?: string
  maxZoom?: number
}

export default function ArcGISImageLayer({
  url,
  attribution,
  maxZoom,
}: ArcGISImageLayerProps) {
  const map = useMap()

  useEffect(() => {
    const layer = imageMapLayer({
      url,
      attribution,
      maxZoom,
      useCors: true,
    })

    layer.addTo(map)

    return () => {
      map.removeLayer(layer)
    }
  }, [map, url, attribution, maxZoom])

  return null
}