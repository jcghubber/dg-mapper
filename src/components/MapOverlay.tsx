import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useMap } from 'react-leaflet'
import type { TileLayerConfig, TileLayerId } from '../tileLayers.js'
import './MapControls.css'

type ControlKey = 'layer' | 'zoom' | 'locate'

type Props = {
  layers: readonly TileLayerConfig[]
  mapLayer: TileLayerId
  setMapLayer: Dispatch<SetStateAction<TileLayerId>>
  locateUser: () => void
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  orientation?: 'vertical' | 'horizontal'
  controlsOrder?: ControlKey[]
}

function MapOverlay({ layers, mapLayer, setMapLayer, locateUser, position = 'top-left', orientation = 'vertical' }: Props) {
  const map = useMap()
  const [zoom, setZoom] = useState<number>(map.getZoom())
  const [showLayerOptions, setShowLayerOptions] = useState(false)

  useEffect(() => {
    const updateZoom = () => setZoom(map.getZoom())
    updateZoom()
    map.on('zoom', updateZoom)
    map.on('zoomend', updateZoom)
    return () => {
      map.off('zoom', updateZoom)
      map.off('zoomend', updateZoom)
    }
  }, [map])

  const handleZoomChange = (delta: number) => {
    map.setZoom(map.getZoom() + delta)
  }

  const activeLayer = layers.find((l) => l.id === mapLayer)

  const controlsOrder = (
    (arguments[0] as Props)?.controlsOrder ?? ['layer', 'zoom', 'locate']
  ) as ControlKey[]

  const layerControl = (
    <div className="layer-group" key="layer">
      <button
        type="button"
        className="overlay-button"
        onClick={() => setShowLayerOptions((s) => !s)}
        title={activeLayer?.label ?? 'Layers'}
        aria-label="Select tile layer"
      >
        {activeLayer?.label ?? 'Layers'}
      </button>
      {showLayerOptions ? (
        <div className="map-layer-selector" role="dialog" aria-label="Select tile layer">
          {layers.map((layer) => (
            <button
              type="button"
              key={layer.id}
              className={`map-layer-option ${layer.id === mapLayer ? 'active' : ''}`}
              onClick={() => {
                setMapLayer(layer.id)
                setShowLayerOptions(false)
              }}
            >
              {layer.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )

  const zoomControl = (
    <div className="zoom-controls-group" key="zoom" aria-label="Map zoom controls">
      <div className="zoom-button-stack" role="group" aria-label="Zoom controls">
        <button type="button" className="zoom-control-button" onClick={() => handleZoomChange(1)} title="Zoom in">
          +
        </button>
        <button type="button" className="zoom-control-button" onClick={() => handleZoomChange(-1)} title="Zoom out">
          −
        </button>
      </div>
      <div className="map-zoom-display" aria-label={`Current zoom level ${zoom}`} title={`Zoom level ${zoom}`}>
        Zoom {zoom}
      </div>
    </div>
  )

  const locateControl = (
    <button type="button" className="overlay-button locate" key="locate" onClick={locateUser} title="Find my location" aria-label="Find my location">
      Locate
    </button>
  )

  const renderMap = () => (
    <div className={`map-overlay ${position} ${orientation}`} role="region" aria-label="Map controls">
      <div className="overlay-controls">
        {controlsOrder.map((k) => {
          if (k === 'layer') return layerControl
          if (k === 'zoom') return zoomControl
          if (k === 'locate') return locateControl
          return null
        })}
      </div>
    </div>
  )

  return renderMap()
}

export default MapOverlay
