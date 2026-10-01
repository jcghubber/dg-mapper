import { useEffect, useRef } from 'react'
import L from 'leaflet'

interface ContextMenuProps {
  position: {
    x: number
    y: number
  } | null
  onMeasure: () => void
  onClose: () => void
}

function ContextMenu({
  position,
  onMeasure,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuRef.current) return

    L.DomEvent.disableClickPropagation(menuRef.current)
    L.DomEvent.disableScrollPropagation(menuRef.current)
  }, [position])

  if (!position) return null

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 2000,
      }}
    >
      <button type="button" onClick={onMeasure}>
        Measure distance
      </button>

      <button type="button" onClick={onClose}>
        Cancel
      </button>
    </div>
  )
}

export default ContextMenu
