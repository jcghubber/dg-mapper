import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useMap } from 'react-leaflet'
import { ActionIcon, Badge, Group, Menu, Stack } from '@mantine/core'
import { IconCheck, IconCurrentLocation, IconLayersLinked, IconMinus, IconPlus } from '@tabler/icons-react'
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

function MapOverlay({
  layers,
  mapLayer,
  setMapLayer,
  locateUser,
  position = 'top-left',
  orientation = 'vertical',
  controlsOrder = ['layer', 'zoom', 'locate'],
}: Props) {
  const map = useMap()
  const [zoom, setZoom] = useState<number>(map.getZoom())

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

  const layerControl = (
    <Menu key="layer" shadow="md" width={220} position="bottom-start" withinPortal zIndex={2000}>
      <Menu.Target>
        <ActionIcon
          size={44}
          radius="xl"
          variant="filled"
          title={activeLayer?.label ?? 'Layers'}
          aria-label="Select tile layer"
        >
          <IconLayersLinked size={20} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {layers.map((layer) => (
          <Menu.Item
            key={layer.id}
            onClick={() => setMapLayer(layer.id)}
            fw={layer.id === mapLayer ? 700 : 400}
            rightSection={layer.id === mapLayer ? <IconCheck size={16} /> : null}
          >
            {layer.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )

  const zoomControl = (
    <Stack key="zoom" gap={6} align="center">
      <ActionIcon.Group orientation="vertical">
        <ActionIcon
          size={36}
          radius="xl"
          variant="filled"
          onClick={() => handleZoomChange(1)}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <IconPlus size={18} />
        </ActionIcon>
        <ActionIcon
          size={36}
          radius="xl"
          variant="filled"
          onClick={() => handleZoomChange(-1)}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <IconMinus size={18} />
        </ActionIcon>
      </ActionIcon.Group>
      <Badge
        size="lg"
        radius="xl"
        variant="filled"
        color="dark"
        title={`Zoom level ${zoom}`}
        aria-label={`Current zoom level ${zoom}`}
      >
        Zoom {zoom}
      </Badge>
    </Stack>
  )

  const locateControl = (
    <ActionIcon
      key="locate"
      size={44}
      radius="xl"
      variant="filled"
      onClick={locateUser}
      title="Find my location"
      aria-label="Find my location"
    >
      <IconCurrentLocation size={20} />
    </ActionIcon>
  )

  const Layout = orientation === 'vertical' ? Stack : Group

  return (
    <div className={`map-overlay ${position} ${orientation}`} role="region" aria-label="Map controls">
      <Layout gap={8}>
        {controlsOrder.map((key) => {
          if (key === 'layer') return layerControl
          if (key === 'zoom') return zoomControl
          if (key === 'locate') return locateControl
          return null
        })}
      </Layout>
    </div>
  )
}

export default MapOverlay
