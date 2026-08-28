# DG Mapper

DG Mapper is a Vite + React app built with Leaflet that shows a slippy map, sample points, and the user's current location when geolocation succeeds.

## Current functionality

- Shows a full-screen Leaflet map with sample points and a current-location marker.
- Uses the browser's geolocation API to center the map on the user's location.
- Includes a floating panel in the upper-right corner with the app title, description, location button, and status text.
- Allows the panel to collapse into a small DG icon in the upper-left of the map, which reopens it.
- Keeps the map full-screen with no outer padding and positions the Leaflet zoom controls below the reopen icon.

## Main files

- [src/App.tsx](src/App.tsx): app logic, geolocation, panel toggle state, and map rendering.
- [src/App.css](src/App.css): layout, overlay panel styling, and map UI behavior.
- [src/lib/supabase.ts](src/lib/supabase.ts): Supabase client initialization.
- [vite.config.ts](vite.config.ts): Vite build configuration.

## Development

Run the development server with:

```bash
npm run dev
```

## TODO
-explore maximum zoom level
-explore hosting on vercel or cloudshare
-have a scale at page bottom

requirements
-create/move/delete tees
-create/move/delete baskets
-create/delete hole
-create/delete course
-publish/unpublish course
