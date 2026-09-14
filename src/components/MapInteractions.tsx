import { useEffect, useState } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { ActionIcon, Paper, Text } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import ContextMenu from './ContextMenu.js'
import { useDistanceMeasurement } from '../hooks/useDistanceMeasurement.js'

interface ContextMenuState {
  x: number
  y: number
  latlng: L.LatLng
}

function MapInteractions() {
  const map = useMap()

  const [contextMenu, setContextMenu] =
    useState<ContextMenuState | null>(null)

  const {
    startMeasurement,
    cancelMeasurement,
    distance,
    liveDistance,
    mousePosition,
    isMeasuring,
  } = useDistanceMeasurement(map)


  useEffect(() => {
    const handleContextMenu = (event: L.LeafletMouseEvent) => {
      setContextMenu({
        x: event.containerPoint.x,
        y: event.containerPoint.y,
        latlng: event.latlng,
      })
    }

    const handleMapClick = () => {
      setContextMenu(null)
    }

    map.on('contextmenu', handleContextMenu)
    map.on('click', handleMapClick)

    return () => {
      map.off('contextmenu', handleContextMenu)
      map.off('click', handleMapClick)
    }
  }, [map])

  const handleMeasure = () => {
    console.log('Measure distance clicked')

    if (!contextMenu) {
      console.log('No context menu state')
      return
    }

    console.log('Starting measurement at:', contextMenu.latlng)

    startMeasurement(contextMenu.latlng)
    setContextMenu(null)
  }


  return (
    <>
      <ContextMenu
        position={contextMenu}
        onMeasure={handleMeasure}
        onClose={() => setContextMenu(null)}
      />

      {isMeasuring && liveDistance !== null && mousePosition ? (
        <div
          className="live-distance-label"
          style={{
            left: mousePosition.x + 14,
            top: mousePosition.y - 34,
          }}
        >
          {liveDistance.toFixed(1)} m
        </div>
      ) : null}

      {distance !== null ? (
        <Paper
          className="distance-display"
          shadow="md"
          radius="md"
          p="xs"
          withBorder
        >
          <Text size="sm" fw={600}>
            Distance: {distance.toFixed(1)} m
          </Text>

          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            onClick={cancelMeasurement}
            aria-label="Close measurement"
            title="Close measurement"
          >
            <IconX size={14} />
          </ActionIcon>
        </Paper>
      ) : null}
    </>
  )
}

export default MapInteractions
