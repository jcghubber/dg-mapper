import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import type L from 'leaflet'

type LongPressOptions = {
  /** Only listens for *new* long-presses starting while true — e.g. gate this
   *  to edit mode + idle state, so a long-press doesn't fire while another
   *  gesture/flow is already active. */
  enabled: boolean
  /** Milliseconds of holding still before it fires. Default 500. */
  delay?: number
  /** Pixels of movement that cancels the pending long-press (a pan, not a
   *  hold). Default 10. */
  moveThresholdPx?: number
}

/**
 * Detects a long-press on the map's empty background (not on a marker, popup,
 * or control) using raw Pointer Events — the same API for mouse, touch, and
 * pen, so no separate touch-handling logic is needed. `isPrimary` is checked
 * so a second finger touching down mid-hold (e.g. starting a pinch) doesn't
 * also register as a competing pointer.
 *
 * Two non-obvious pieces, both handled in the always-on effect below rather
 * than the `enabled`-gated one:
 *
 * 1. Releasing the pointer after a long press still fires a native browser
 *    'click' (a press-then-release with little movement fires click
 *    regardless of hold duration), and Leaflet's own closePopupOnClick
 *    behavior would otherwise immediately close whatever this long-press
 *    just opened. A capture-phase click listener swallows exactly that one
 *    trailing click.
 *
 * 2. Firing the long-press callback flips `enabled` to false in the same
 *    synchronous update (the caller gates it on `mode.kind === 'idle'`,
 *    which changes the instant this fires) — *before* the user has actually
 *    released their pointer yet. If the "pointer released, re-enable
 *    dragging and arm the click-suppression flag" logic lived in the
 *    `enabled`-gated effect, its own cleanup would remove that very listener
 *    the moment `enabled` flips, so it would never see the real release at
 *    all. `firedRef` is shared between both effects specifically so this
 *    handling can live in the one that doesn't get torn down at that moment.
 */
export function useLongPressOnMap(onLongPress: (latlng: L.LatLng) => void, options: LongPressOptions) {
  const map = useMap()

  const onLongPressRef = useRef(onLongPress)
  onLongPressRef.current = onLongPress

  const suppressNextClickRef = useRef(false)
  const suppressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedRef = useRef(false)

  // Always-on: reacts to a long-press having fired (via firedRef), regardless
  // of what `enabled` is doing at that moment.
  useEffect(() => {
    const container = map.getContainer()

    function onPointerUpAfterFire() {
      if (firedRef.current) {
        firedRef.current = false
        map.dragging.enable()
        suppressNextClickRef.current = true

        // Self-healing: the trailing click is expected almost immediately,
        // but isn't guaranteed to arrive (platform/timing-dependent — the
        // browser doesn't owe us a click here, it's just the common case).
        // Without this, a click that never comes leaves the flag armed
        // indefinitely, and the *next* unrelated click anywhere on the map
        // — e.g. the person's actual attempt to dismiss the popup — gets
        // wrongly swallowed instead. That click never reaching Leaflet means
        // it never closes the popup, which means our CANCEL dispatch never
        // fires, which leaves the whole flow stuck until a manual reset
        // (toggling edit mode, or reloading). Clearing it after a short
        // window closes that hole.
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

    container.addEventListener('pointerup', onPointerUpAfterFire)
    container.addEventListener('pointercancel', onPointerUpAfterFire)
    container.addEventListener('click', onClickCapture, true)

    return () => {
      if (suppressTimeoutRef.current) clearTimeout(suppressTimeoutRef.current)
      container.removeEventListener('pointerup', onPointerUpAfterFire)
      container.removeEventListener('pointercancel', onPointerUpAfterFire)
      container.removeEventListener('click', onClickCapture, true)
    }
  }, [map])

  // Gated on `enabled`: only for detecting a *new* long-press starting.
  useEffect(() => {
    if (!options.enabled) return

    const delay = options.delay ?? 500
    const threshold = options.moveThresholdPx ?? 10
    const container = map.getContainer()

    let timer: ReturnType<typeof setTimeout> | null = null
    let startPoint: { x: number; y: number } | null = null
    let candidateLatLng: L.LatLng | null = null

    function clearTimer() {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }

    function onPointerDown(e: PointerEvent) {
      if (!e.isPrimary) return

      // Markers, popups, and our own floating controls handle their own
      // interactions — only empty map background should start an add-point
      // long-press. '.leaflet-interactive' covers vector layers (hole lines,
      // the "you are here" circle).
      const target = e.target as HTMLElement
      if (target.closest('.leaflet-marker-icon, .leaflet-popup, .leaflet-control, .leaflet-interactive')) {
        return
      }

      startPoint = { x: e.clientX, y: e.clientY }
      const rect = container.getBoundingClientRect()
      candidateLatLng = map.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top])

      timer = setTimeout(() => {
        timer = null
        firedRef.current = true
        // Only disabled once we've confirmed this is an edit gesture, not a
        // pan — disabling immediately on pointerdown would make a quick pan
        // feel broken while waiting on the timer.
        map.dragging.disable()
        if (candidateLatLng) onLongPressRef.current(candidateLatLng)
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
      // Only relevant if released *before* the timer fired (a short tap, or
      // a cancel) — the fired case is handled by the always-on effect above.
      clearTimer()
      startPoint = null
    }

    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerup', onPointerUpOrCancelDuringHold)
    container.addEventListener('pointercancel', onPointerUpOrCancelDuringHold)

    return () => {
      clearTimer()
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', onPointerUpOrCancelDuringHold)
      container.removeEventListener('pointercancel', onPointerUpOrCancelDuringHold)
    }
  }, [map, options.enabled, options.delay, options.moveThresholdPx])
}
