import { createTheme, Modal, Popover } from '@mantine/core'

/**
 * Single place to control the app's overall look and feel.
 *
 * - `primaryColor`: any built-in Mantine color name (blue, cyan, teal, grape, etc.) or a
 *   custom color added under `colors` below. Every default-colored button, link, and
 *   active control follows this automatically — change it here, not per-component.
 *   To use a custom brand color instead of a built-in one: generate a 10-shade palette at
 *   https://mantine.dev/colors-generator/, add it under `colors`, then set `primaryColor`
 *   to its name.
 * - `defaultRadius`: how rounded controls are app-wide, from 'xs' (barely rounded) to
 *   'xl' (very rounded), or a specific pixel value (e.g. 999 for fully pill-shaped).
 * - `fontFamily`: carried over from the app's existing global styles.
 * - `components.Popover`/`components.Modal`: our own floating map controls (layer
 *   picker button, zoom stack, login/user button) sit at z-index 900–1200 so they clear
 *   Leaflet's internal panes — and Leaflet's own panes go even higher than that on their
 *   own (marker pane 600, popup pane 700). Mantine's Popover (which Menu, Select,
 *   Combobox, etc. are built on) defaults to z-index 300, and Modal defaults to 200 —
 *   both well below Leaflet's panes. Without this override, a Leaflet marker or popup
 *   positioned on screen underneath a dropdown or dialog would intercept clicks meant
 *   for it, intermittently, depending on where the map happened to be panned. This
 *   raises both above every Leaflet pane and our own controls, for every current and
 *   future Popover/Modal-based component, rather than needing a `zIndex` prop set
 *   individually wherever one is used.
 */
export const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',

  components: {
    Popover: Popover.extend({
      defaultProps: {
        zIndex: 1300,
      },
    }),
    Modal: Modal.extend({
      defaultProps: {
        zIndex: 1400,
      },
    }),
  },

  // colors: {
  //   brand: ['#...', '#...', '#...', '#...', '#...', '#...', '#...', '#...', '#...', '#...'],
  // },
})
