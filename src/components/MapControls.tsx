import { useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { User } from '@supabase/supabase-js'
import type { TileLayerConfig, TileLayerId } from '../tileLayers.js'
import './MapControls.css'

type MapControlsProps = {
  isLoggedIn: boolean
  toggleUserMenu: () => void
  showUserMenu: boolean
  mapLoginButtonRef: RefObject<HTMLButtonElement | null>
  userMenuRef: RefObject<HTMLDivElement | null>
  handleLogout: () => void
  openLoginDialog: () => void
  user: User | null
}

function MapControls({ isLoggedIn, toggleUserMenu, showUserMenu, mapLoginButtonRef, userMenuRef, handleLogout, openLoginDialog, user }: MapControlsProps) {
  return (
    <>
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
