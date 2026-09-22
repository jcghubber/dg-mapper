import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

type Options = {
  /** Only listens for a *new* long-press starting while true. */
  enabled: boolean
  delay?: number
  moveThresholdPx?: number
}

/**
 * Long-press detection on a single DOM element (a marker's own icon, a hole
 * label), as opposed to useLongPressOnMap's map-background detection. Shares
 * the same core mechanics and the same two hard-won fixes documented there:
 * Pointer Events for touch/mouse parity, and swallowing the native 'click'
 * that follows releasing after a long press so it doesn't also trigger
 * whatever click behavior the element already has (e.g. Leaflet's own
 * marker-click-opens-popup) — including the self-healing timeout on that
 * suppression, so a click that never arrives can't leak into wrongly eating
 * some later, unrelated click on the same element.
 */
export function useLongPressOnElement(element: HTMLElement | null, onLongPress: () => void, options: Options) {
  const map = useMap()
  const onLongPressRef = useRef(onLongPress)
  onLongPressRef.current = onLongPress

  const suppressNextClickRef = useRef(false)
  const suppressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedRef = useRef(false)

  // Always-on relative to `element` — not gated by `enabled`, since firing
  // flips `enabled` off in the same synchronous update that starts it, before
  // the user has released their pointer yet. See useLongPressOnMap for the
  // full reasoning; identical here.
  useEffect(() => {
    if (!element) return

    function onPointerUpAfterFire() {
      if (firedRef.current) {
        firedRef.current = false
        map.dragging.enable()
        suppressNextClickRef.current = true

        if (suppressTimeoutRef.current) clearTimeout(suppressTimeoutRef.current)
        suppressTimeoutRef.current = setTimeout(() => {
          suppressNextClickRef.current = false
          suppressTimeoutRef.current = null
        }, 400)
      }
    }

    function onClickCapture(e: MouseEvent) {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false
        if (suppressTimeoutRef.current) {
          clearTimeout(suppressTimeoutRef.current)
          suppressTimeoutRef.current = null
        }
        e.stopPropagation()
        e.preventDefault()
      }
    }

    element.addEventListener('pointerup', onPointerUpAfterFire)
    element.addEventListener('pointercancel', onPointerUpAfterFire)
    element.addEventListener('click', onClickCapture, true)

    return () => {
      if (suppressTimeoutRef.current) clearTimeout(suppressTimeoutRef.current)
      element.removeEventListener('pointerup', onPointerUpAfterFire)
      element.removeEventListener('pointercancel', onPointerUpAfterFire)
      element.removeEventListener('click', onClickCapture, true)
    }
  }, [element, map])

  // Gated on `enabled`: only for detecting a *new* long-press starting.
  useEffect(() => {
    if (!element || !options.enabled) return

    const delay = options.delay ?? 500
    const threshold = options.moveThresholdPx ?? 10

    let timer: ReturnType<typeof setTimeout> | null = null
    let startPoint: { x: number; y: number } | null = null

    function clearTimer() {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }

    function onPointerDown(e: PointerEvent) {
      if (!e.isPrimary) return
      startPoint = { x: e.clientX, y: e.clientY }

      timer = setTimeout(() => {
        timer = null
        firedRef.current = true
        map.dragging.disable()
        onLongPressRef.current()
      }, delay)
    }

    function onPointerMove(e: PointerEvent) {
      if (!startPoint || !timer) return
      const dx = e.clientX - startPoint.x
      const dy = e.clientY - startPoint.y
      if (Math.hypot(dx, dy) > threshold) {
        clearTimer()
      }
    }

    function onPointerUpOrCancelDuringHold() {
      clearTimer()
      startPoint = null
    }

    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', onPointerUpOrCancelDuringHold)
    element.addEventListener('pointercancel', onPointerUpOrCancelDuringHold)

    return () => {
      clearTimer()
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', onPointerUpOrCancelDuringHold)
      element.removeEventListener('pointercancel', onPointerUpOrCancelDuringHold)
    }
  }, [element, map, options.enabled, options.delay, options.moveThresholdPx])
}
