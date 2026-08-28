import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import type { TileErrorEvent } from 'leaflet'
import { supabase } from './lib/supabase.js'
import AuthDialog from './components/AuthDialog.js'
import MapControls from './components/MapControls.js'
import MapOverlay from './components/MapOverlay.js'
import ResetPasswordConfirm from './components/ResetPasswordConfirm.js'
import { tileLayers, type TileLayerId } from './tileLayers.js'
import ArcGISImageLayer from './components/ArcGISImageLayer.js'
import './App.css'

type MapLayer = TileLayerId
type AuthMode = 'login' | 'signup' | 'reset' | 'magic-link'

const points: { name: string; position: [number, number]; description: string }[] = [
  {
    name: 'River Walk',
    position: [51.505, -0.09],
    description: 'A calm riverside stop with skyline views.',
  },
  {
    name: 'Old Town',
    position: [51.51, -0.1],
    description: 'Historic streets and cozy cafés.',
  },
  {
    name: 'Harbor Point',
    position: [51.499, -0.08],
    description: 'A breezy waterfront for a quick break.',
  },
]

function RecenterAutomatically({ position }: { position: [number, number] }) {
  const map = useMap()

  useEffect(() => {
    if (position && map) {
      map.setView(position, map.getZoom())
    }
  }, [map, position])

  return null
}

// zoom controls and layer/locate are provided via MapOverlay component

function App() {
  const [position, setPosition] = useState<[number, number]>([51.505, -0.09])
  const [locationError, setLocationError] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [mapLayer, setMapLayer] = useState<MapLayer>((tileLayers[0]?.id ?? 'osm') as TileLayerId)
  const [user, setUser] = useState<User | null>(null)
  const isLoggedIn = Boolean(user)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showConfirmReset, setShowConfirmReset] = useState(false)
  const [tileNotice, setTileNotice] = useState('')
  const tileErrorCountRef = useRef(0)
  const mapLoginButtonRef = useRef<HTMLButtonElement | null>(null)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const loginDialogRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const locateUser = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.')
      setIsLocating(false)
      return
    }

    setIsLocating(true)
    setLocationError('')

    navigator.geolocation.getCurrentPosition(
      (geoPosition) => {
        const nextPosition: [number, number] = [geoPosition.coords.latitude, geoPosition.coords.longitude]
        setPosition(nextPosition)
        setIsLocating(false)
      },
      (err) => {
        setLocationError(err.message || 'Unable to access your location right now.')
        setIsLocating(false)
      },
      { enableHighAccuracy: false, timeout: 5000 },
    )
  }

  useEffect(() => {
    if (!navigator.permissions) {
      return
    }

    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      if (status.state === 'granted') {
        locateUser()
      }
    })
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })

    // supabase-js auto-detects a recovery token in the URL (detectSessionInUrl is on by
    // default) and fires this event once that session is actually established — so this
    // is also the correct place to reveal the "set new password" form, rather than
    // parsing the URL ourselves ahead of time.
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null)
        if (event === 'PASSWORD_RECOVERY') {
          setShowConfirmReset(true)
        }
      },
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handleBodyClick = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) {
        return
      }

      if (
        showUserMenu &&
        userMenuRef.current &&
        mapLoginButtonRef.current &&
        !userMenuRef.current.contains(event.target) &&
        !mapLoginButtonRef.current.contains(event.target)
      ) {
        setShowUserMenu(false)
      }

      if (showLoginDialog && loginDialogRef.current && !loginDialogRef.current.contains(event.target)) {
        setShowLoginDialog(false)
      }

      if (
        panelOpen &&
        panelRef.current &&
        !panelRef.current.contains(event.target)
      ) {
        setPanelOpen(false)
      }
    }

    document.addEventListener('mousedown', handleBodyClick)
    return () => document.removeEventListener('mousedown', handleBodyClick)
  }, [panelOpen, showLoginDialog, showUserMenu])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    setAuthNotice('')
    setIsAuthenticating(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    })

    setIsAuthenticating(false)

    if (error) {
      setAuthError(error.message)
      return
    }

    if (data.session?.user) {
      setShowLoginDialog(false)
      setShowUserMenu(false)
      setAuthEmail('')
      setAuthPassword('')
      setAuthError('')
      setAuthNotice('')
    }
  }

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    setAuthNotice('')
    setIsAuthenticating(true)

    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
    })

    setIsAuthenticating(false)

    if (error) {
      setAuthError(error.message)
      return
    }

    if (data.session?.user) {
      setShowLoginDialog(false)
      setShowUserMenu(false)
      setAuthEmail('')
      setAuthPassword('')
      setAuthError('')
      setAuthNotice('')
      return
    }

    setAuthNotice('Check your email for a confirmation link, then sign in.')
  }

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    setAuthNotice('')
    setIsAuthenticating(true)

    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: window.location.origin,
    })

    setIsAuthenticating(false)

    if (error) {
      setAuthError(error.message)
      return
    }

    setAuthNotice('Check your email for a password reset link.')
    setAuthEmail('')
  }

  const handleMagicLinkLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    setAuthNotice('')
    setIsAuthenticating(true)

    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    setIsAuthenticating(false)

    if (error) {
      setAuthError(error.message)
      return
    }

    setAuthNotice('Check your email for a secure sign-in link.')
    setAuthEmail('')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setShowUserMenu(false)
  }

  const toggleUserMenu = () => {
    setShowUserMenu((current) => !current)
  }

  const activeLayer =
    tileLayers.find((layer) => layer.id === mapLayer) ?? tileLayers[0]!

  const handleTileError = (_event: TileErrorEvent) => {
    tileErrorCountRef.current += 1

    if (tileErrorCountRef.current >= 5) {
      setTileNotice(
        `Unable to load ${activeLayer.label} tiles at this location. Try zooming out or switching layers.`,
      )
    }
  }

  const handleTileLoad = () => {
    tileErrorCountRef.current = 0
    setTileNotice('')
  }

  const dismissTileNotice = () => {
    setTileNotice('')
  }

  useEffect(() => {
    tileErrorCountRef.current = 0
    setTileNotice('')
  }, [mapLayer])

  return (
    <main className={`app-shell ${panelOpen ? '' : 'collapsed'}`}>
      <header className="hero-card" ref={panelRef}>
        <div className="hero-card-copy">
          <p className="eyebrow">React + Vite + Leaflet</p>
          <h1>DG Mapper</h1>
          <p className="hero-copy">
            A polished, installable map app with a smooth, slippy map experience.
          </p>
        </div>

        <div className="hero-card-actions">
          <button
            type="button"
            className="panel-close-button"
            onClick={() => setPanelOpen(false)}
            aria-label="Collapse panel"
          >
            ×
          </button>

          <div className="controls">
            {locationError ? <p className="status-text error">{locationError}</p> : null}
            {!locationError && !isLocating && position ? (
              <p className="status-text">
                Your location is now shown on the map: {position[0].toFixed(5)}, {position[1].toFixed(5)}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section className="map-card" aria-label="Leaflet map">
        {!panelOpen ? (
          <button
            type="button"
            className="main-menu-button"
            onClick={() => setPanelOpen(true)}
            aria-label="Open panel"
            title="Open DG Mapper panel"
          >
            DGMapper
          </button>
        ) : null}

        <MapControls
          isLoggedIn={isLoggedIn}
          toggleUserMenu={toggleUserMenu}
          showUserMenu={showUserMenu}
          mapLoginButtonRef={mapLoginButtonRef}
          userMenuRef={userMenuRef}
          handleLogout={handleLogout}
          openLoginDialog={() => {
            setAuthMode('login')
            setAuthError('')
            setAuthNotice('')
            setShowLoginDialog(true)
          }}
          user={user}
        />

        <AuthDialog
          showLoginDialog={showLoginDialog}
          loginDialogRef={loginDialogRef}
          authMode={authMode}
          authEmail={authEmail}
          authPassword={authPassword}
          authError={authError}
          authNotice={authNotice}
          isAuthenticating={isAuthenticating}
          setAuthMode={setAuthMode}
          setAuthEmail={setAuthEmail}
          setAuthPassword={setAuthPassword}
          setAuthError={setAuthError}
          setAuthNotice={setAuthNotice}
          setShowLoginDialog={setShowLoginDialog}
          handleLogin={handleLogin}
          handleSignup={handleSignup}
          handleResetPassword={handleResetPassword}
          handleMagicLinkLogin={handleMagicLinkLogin}
        />

        {showConfirmReset ? (
          <ResetPasswordConfirm
            onDone={(success) => {
              setShowConfirmReset(false)
              if (success) {
                setShowLoginDialog(false)
                setShowUserMenu(false)
              }
            }}
          />
        ) : null}

        <MapContainer center={position} zoom={13} scrollWheelZoom zoomControl={false} maxZoom={23}>
          {tileNotice ? (
            <div className="tile-notice" role="status">
              <span>{tileNotice}</span>
              <button type="button" className="tile-notice-dismiss" onClick={dismissTileNotice} aria-label="Dismiss tile notice">
                ×
              </button>
            </div>
          ) : null}
          {activeLayer.type === 'image' ? (
            <ArcGISImageLayer
              url={activeLayer.url}
              attribution={activeLayer.attribution}
              maxZoom={activeLayer.maxZoom ?? 23}
            />
          ) : (
            <TileLayer
              attribution={activeLayer.attribution}
              url={activeLayer.url}
              maxZoom={activeLayer.maxZoom ?? 23}
              maxNativeZoom={activeLayer.maxNativeZoom ?? 23}
              eventHandlers={{
                tileerror: handleTileError,
                load: handleTileLoad,
              }}
            />
          )}

          <RecenterAutomatically position={position} />
          <MapOverlay
            layers={tileLayers}
            mapLayer={mapLayer}
            setMapLayer={setMapLayer}
            locateUser={locateUser}
            position="top-left"
            orientation="vertical"
          />

          {points.map((point) => (
            <CircleMarker
              key={point.name}
              center={point.position}
              pathOptions={{ color: '#38bdf8', fillColor: '#0ea5e9', fillOpacity: 0.85 }}
              radius={12}
            >
              <Popup>
                <strong>{point.name}</strong>
                <br />
                {point.description}
              </Popup>
            </CircleMarker>
          ))}

          {!locationError && position ? (
            <CircleMarker
              center={position}
              pathOptions={{ color: '#facc15', fillColor: '#fde047', fillOpacity: 0.95 }}
              radius={10}
            >
              <Popup>You are here</Popup>
            </CircleMarker>
          ) : null}
        </MapContainer>
      </section>
    </main>
  )
}

export default App
