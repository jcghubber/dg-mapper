import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'

interface MousePosition {
  x: number
  y: number
}

export function useDistanceMeasurement(map: L.Map | null) {
  const [distance, setDistance] = useState<number | null>(null)
  const [liveDistance, setLiveDistance] = useState<number | null>(null)
  const [mousePosition, setMousePosition] = useState<MousePosition | null>(null)
  const [isMeasuring, setIsMeasuring] = useState(false)

  const measuringRef = useRef(false)
  const startPointRef = useRef<L.LatLng | null>(null)
  const lineRef = useRef<L.Polyline | null>(null)
  const startMarkerRef = useRef<L.CircleMarker | null>(null)

  useEffect(() => {
    if (!map) return

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (!measuringRef.current || !startPointRef.current) return

      const start = startPointRef.current

      if (lineRef.current) {
        lineRef.current.setLatLngs([start, e.latlng])
      }

      // Update the live distance.
      setLiveDistance(start.distanceTo(e.latlng))

      // containerPoint is relative to the map container, which is exactly
      // what we need for positioning an HTML label over the map.
      setMousePosition({
        x: e.containerPoint.x,
        y: e.containerPoint.y,
      })
    }

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (!measuringRef.current || !startPointRef.current) return

      const start = startPointRef.current
      const end = e.latlng

      const metres = start.distanceTo(end)

      if (lineRef.current) {
        lineRef.current.setLatLngs([start, end])
      }

      setDistance(metres)

      measuringRef.current = false
      startPointRef.current = null
      setIsMeasuring(false)
      setLiveDistance(null)
      setMousePosition(null)
    }

    map.on('mousemove', handleMouseMove)
    map.on('click', handleClick)

    return () => {
      map.off('mousemove', handleMouseMove)
      map.off('click', handleClick)
    }
  }, [map])

  const startMeasurement = (latlng: L.LatLng) => {
    if (!map) return

    if (lineRef.current) {
      map.removeLayer(lineRef.current)
      lineRef.current = null
    }

    if (startMarkerRef.current) {
      map.removeLayer(startMarkerRef.current)
      startMarkerRef.current = null
    }

    setDistance(null)
    setLiveDistance(null)
    setMousePosition(null)

    startPointRef.current = latlng
    measuringRef.current = true
    setIsMeasuring(true)

    lineRef.current = L.polyline(
      [latlng, latlng],
      {
        color: '#3388ff',
        weight: 3,
        dashArray: '6 6',
      },
    ).addTo(map)

    startMarkerRef.current = L.circleMarker(
      latlng,
      {
        radius: 6,
        color: '#3388ff',
        weight: 2,
        fillColor: '#ffffff',
        fillOpacity: 1,
      },
    ).addTo(map)
  }

  const cancelMeasurement = () => {
    measuringRef.current = false
    startPointRef.current = null
    setIsMeasuring(false)
    setLiveDistance(null)
    setMousePosition(null)

    if (lineRef.current && map) {
      map.removeLayer(lineRef.current)
      lineRef.current = null
    }

    if (startMarkerRef.current && map) {
      map.removeLayer(startMarkerRef.current)
      startMarkerRef.current = null
    }

    setDistance(null)
  }

  return {
    startMeasurement,
    cancelMeasurement,
    distance,
    liveDistance,
    mousePosition,
    isMeasuring,
  }
}
