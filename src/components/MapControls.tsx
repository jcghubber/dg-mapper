import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { User } from '@supabase/supabase-js'
import './MapControls.css'

type MapLayer = 'osm' | 'satellite'

type MapControlsProps = {
  mapLayer: MapLayer
  setMapLayer: Dispatch<SetStateAction<MapLayer>>
  locateUser: () => void
  isLoggedIn: boolean
  toggleUserMenu: () => void
  showUserMenu: boolean
  mapLoginButtonRef: RefObject<HTMLButtonElement>
  userMenuRef: RefObject<HTMLDivElement>
  handleLogout: () => void
  openLoginDialog: () => void
  user: User | null
}

function MapControls({
  mapLayer,
  setMapLayer,
  locateUser,
  isLoggedIn,
  toggleUserMenu,
  showUserMenu,
  mapLoginButtonRef,
  userMenuRef,
  handleLogout,
  openLoginDialog,
  user,
}: MapControlsProps) {
  return (
    <>
      <button
        type="button"
        className="map-layer-button"
        onClick={() => setMapLayer((current) => (current === 'osm' ? 'satellite' : 'osm'))}
        aria-label={mapLayer === 'osm' ? 'Switch to satellite view' : 'Switch to street view'}
        title={mapLayer === 'osm' ? 'Switch to satellite view' : 'Switch to street view'}
      >
        {mapLayer === 'osm' ? 'Satellite' : 'Street'}
      </button>

      <button
        type="button"
        className="map-locate-button"
        onClick={locateUser}
        aria-label="Find my location"
        title="Find my location"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="currentColor">
          <path d="M12 2a1 1 0 0 1 .99.878L13 3v2.07a7 7 0 0 1 4.93 4.93H20a1 1 0 0 1 .117 1.993L20 12h-2.07a7 7 0 0 1-4.93 4.93V19a1 1 0 0 1-1.993.117L12 19v-2.07a7 7 0 0 1-4.93-4.93H4a1 1 0 0 1-.117-1.993L4 12h2.07a7 7 0 0 1 4.93-4.93V4a1 1 0 0 1 1-1zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
        </svg>
      </button>

      <button
        type="button"
        className="map-login-button"
        ref={mapLoginButtonRef}
        onClick={isLoggedIn ? toggleUserMenu : openLoginDialog}
        aria-label={isLoggedIn ? 'Open user menu' : 'Log in'}
        title={isLoggedIn ? 'Open user menu' : 'Log in'}
      >
        {isLoggedIn ? '👤' : 'Log in'}
      </button>

      {isLoggedIn && showUserMenu ? (
        <div className="map-user-menu" ref={userMenuRef}>
          <div className="user-menu-item user-menu-title">Signed in as {user?.email ?? 'Account'}</div>
          <button type="button" className="user-menu-item" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      ) : null}
    </>
  )
}

export default MapControls
