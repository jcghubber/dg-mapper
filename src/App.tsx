import { useEffect, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { supabase } from './lib/supabase'
import AuthDialog from './components/AuthDialog'
import MapControls from './components/MapControls'
import './App.css'

let hasAttemptedInitialLocation = false

const points = [
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

function RecenterAutomatically({ position }) {
  const map = useMap()

  useEffect(() => {
    if (position && map) {
      map.setView(position, map.getZoom())
    }
  }, [map, position])

  return null
}

function ZoomControlOverlay() {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())

  useEffect(() => {
    const updateZoom = () => setZoom(map.getZoom())

    updateZoom()
    map.on('zoom', updateZoom)
    map.on('zoomend', updateZoom)

    return () => {
      map.off('zoom', updateZoom)
      map.off('zoomend', updateZoom)
    }
  }, [map])

  const handleZoomChange = (delta) => {
    map.setZoom(map.getZoom() + delta)
  }

  return (
    <div className="zoom-controls-group" aria-label="Map zoom controls">
      <div className="zoom-button-stack" role="group" aria-label="Zoom controls">
        <button
          type="button"
          className="zoom-control-button"
          onClick={() => handleZoomChange(1)}
          aria-label="Zoom in"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="zoom-control-button"
          onClick={() => handleZoomChange(-1)}
          aria-label="Zoom out"
          title="Zoom out"
        >
          −
        </button>
      </div>

      <div className="map-zoom-display" aria-label={`Current zoom level ${zoom}`} title={`Zoom level ${zoom}`}>
        Zoom {zoom}
      </div>
    </div>
  )
}

function App() {
  const [position, setPosition] = useState([51.505, -0.09])
  const [locationError, setLocationError] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [mapLayer, setMapLayer] = useState('osm')
  const [user, setUser] = useState(null)
  const isLoggedIn = Boolean(user)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [tileNotice, setTileNotice] = useState('')
  const mapLoginButtonRef = useRef(null)
  const userMenuRef = useRef(null)
  const loginDialogRef = useRef(null)
  const panelRef = useRef(null)

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
        console.log('Geolocation success:', geoPosition)
        const nextPosition = [geoPosition.coords.latitude, geoPosition.coords.longitude]
        setPosition(nextPosition)
        setIsLocating(false)
      },
      (err) => {
        console.error('Geolocation error:', err)
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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handleBodyClick = (event) => {
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

  const handleLogin = async (event) => {
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

  const handleSignup = async (event) => {
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

  const handleResetPassword = async (event) => {
    event.preventDefault()
    setAuthError('')
    setAuthNotice('')
    setIsAuthenticating(true)

    const { data, error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: window.location.origin,
    })

    setIsAuthenticating(false)

    if (error) {
      setAuthError(error.message)
      return
    }

    setAuthNotice('Check your email for a password reset link.')
    if (data?.user) {
      setAuthEmail('')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setShowUserMenu(false)
  }

  const toggleUserMenu = () => {
    setShowUserMenu((current) => !current)
  }

  const handleTileError = (event) => {
    const layerName = mapLayer === 'osm' ? 'OpenStreetMap' : 'satellite imagery'
    const zoom = event?.target?._map?.getZoom?.() ?? 'the current zoom level'
    setTileNotice(`No tiles available for ${layerName} at zoom ${zoom}. Try zooming out or switching layers.`)
  }

  const handleTileLoad = () => {
    setTileNotice('')
  }

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
          mapLayer={mapLayer}
          setMapLayer={setMapLayer}
          locateUser={locateUser}
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
          setShowLoginDialog={setShowLoginDialog}
          handleLogin={handleLogin}
          handleSignup={handleSignup}
          handleResetPassword={handleResetPassword}
        />
        <MapContainer center={position} zoom={13} scrollWheelZoom zoomControl={false} maxZoom={23}>
          {tileNotice ? (
            <div className="tile-notice" role="status">
              {tileNotice}
            </div>
          ) : null}
          {mapLayer === 'osm' ? (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={23}
              maxNativeZoom={19}
              eventHandlers={{
                tileerror: handleTileError,
                load: handleTileLoad,
              }}
            />
          ) : (
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={23}
              maxNativeZoom={23}
              eventHandlers={{
                tileerror: handleTileError,
                load: handleTileLoad,
              }}
            />
          )}

          <RecenterAutomatically position={position} />
          <ZoomControlOverlay />

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
