import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import type { Map as LeafletMap, TileErrorEvent } from 'leaflet'
import { ActionIcon, Badge, Button, Group, Paper, SegmentedControl, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconEdit, IconEye, IconMenu2, IconPlus, IconX } from '@tabler/icons-react'
import { supabase } from './lib/supabase.js'
import AuthDialog from './components/AuthDialog.js'
import MapControls from './components/MapControls.js'
import MapOverlay from './components/MapOverlay.js'
import ResetPasswordConfirm from './components/ResetPasswordConfirm.js'
import CourseLayer from './components/CourseLayer.js'
import { useDefaultCourse } from './hooks/useDefaultCourse.js'
import { useCourseData } from './hooks/useCourseData.js'
import type { Course } from './types/database.js'
import { tileLayers, type TileLayerId } from './tileLayers.js'
import ArcGISImageLayer from './components/ArcGISImageLayer.js'
import MapInteractions from './components/MapInteractions.js'
import './App.css'

type MapLayer = TileLayerId
type AuthMode = 'login' | 'signup' | 'reset' | 'magic-link'

const TILE_NOTICE_ID = 'tile-error-notice'

function RecenterAutomatically({ position }: { position: [number, number] }) {
  const map = useMap()

  useEffect(() => {
    if (position && map) {
      map.setView(position, map.getZoom())
    }
  }, [map, position])

  return null
}

/** Recenters the map on a course's HQ location once it loads. Deliberately keyed
 *  on `course?.id` rather than the whole `course` object — a rename or other field
 *  change shouldn't yank the map away from wherever the person is currently looking;
 *  only an actual *different course* loading should move it. */
function RecenterOnCourseHQ({ course }: { course: Course | null }) {
  const map = useMap()

  useEffect(() => {
    if (course) {
      map.setView([course.hq_lat, course.hq_lng], map.getZoom())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, course?.id])

  return null
}

// zoom controls and layer/locate are provided via MapOverlay component

function App() {
  // Default center: Canberra, ACT — matches the app's Canberra aerial imagery
  // layers and existing test data. Overridden by real geolocation on load if
  // available (see the permissions-check effect below).
  const [position, setPosition] = useState<[number, number]>([-35.3075, 149.1244])
  const [locationError, setLocationError] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [mapLayer, setMapLayer] = useState<MapLayer>((tileLayers[0]?.id ?? 'osm') as TileLayerId)
  const [user, setUser] = useState<User | null>(null)
  const isLoggedIn = Boolean(user)
  const { course, courseId, loading: courseLoading, error: courseError } = useDefaultCourse(user?.id ?? null, {
    lat: position[0],
    lng: position[1],
  })
  const { points, holes, addPoint, removePoint } = useCourseData(courseId)

  // Course-edit mode vs. the default view mode — see architecture.md §3. Only the
  // course's owner can ever be in edit mode; a non-owner (once viewing other users'
  // public courses is built) should never see editing affordances at all, regardless
  // of local state, hence deriving `isEditMode` from `isOwner` rather than trusting
  // `editModeRequested` alone.
  const isOwner = Boolean(user && course && course.created_by === user.id)
  const [editModeRequested, setEditModeRequested] = useState(false)
  const isEditMode = isOwner && editModeRequested

  const testPointCountRef = useRef(0)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [showConfirmReset, setShowConfirmReset] = useState(false)
  const tileErrorCountRef = useRef(0)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)

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

  // Note: this app used to auto-locate on mount if geolocation permission was
  // already granted. Removed — it would immediately override the map centering
  // on the active course's HQ location below, which should take priority on
  // load. The "locate me" button (via locateUser, unchanged) still works exactly
  // as before whenever the person explicitly wants to jump to their real position.

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

  // Mantine's Modal (AuthDialog, ResetPasswordConfirm) and Menu (MapControls' user menu)
  // handle their own backdrop/outside-click behavior internally, so this effect now only
  // needs to manage the hero panel, which is a bespoke collapse-on-outside-click element.
  useEffect(() => {
    const handleBodyClick = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) {
        return
      }

      if (panelOpen && panelRef.current && !panelRef.current.contains(event.target)) {
        setPanelOpen(false)
      }
    }

    document.addEventListener('mousedown', handleBodyClick)
    return () => document.removeEventListener('mousedown', handleBodyClick)
  }, [panelOpen])

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
  }

  // TEMPORARY: quick way to verify the Supabase data layer end-to-end through the UI,
  // before the real long-press "add point" flow exists. Adds a point at the current
  // map center, alternating tee/basket. Remove once that flow is built.
  const handleAddTestPoint = async () => {
    const center = mapRef.current?.getCenter()
    if (!center) {
      notifications.show({ color: 'red', message: 'Map not ready yet — try again in a moment.' })
      return
    }

    testPointCountRef.current += 1
    const n = testPointCountRef.current
    const type = n % 2 === 1 ? 'tee' : 'basket'
    try {
      await addPoint({ type, name: `Test ${type} ${n}`, lat: center.lat, lng: center.lng })
      notifications.show({ color: 'green', message: `Added test ${type} at crosshair.` })
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'Failed to add test point.',
      })
    }
  }

  const activeLayer =
    tileLayers.find((layer) => layer.id === mapLayer) ?? tileLayers[0]!

  const handleTileError = (_event: TileErrorEvent) => {
    tileErrorCountRef.current += 1

    if (tileErrorCountRef.current >= 5) {
      notifications.show({
        id: TILE_NOTICE_ID,
        color: 'red',
        title: 'Map tiles',
        message: `Unable to load ${activeLayer.label} tiles at this location. Try zooming out or switching layers.`,
        autoClose: false,
        withCloseButton: true,
      })
    }
  }

  const handleTileLoad = () => {
    tileErrorCountRef.current = 0
    notifications.hide(TILE_NOTICE_ID)
  }

  useEffect(() => {
    tileErrorCountRef.current = 0
    notifications.hide(TILE_NOTICE_ID)
  }, [mapLayer])

  return (
    <main className={`app-shell ${panelOpen ? '' : 'collapsed'}`}>
      <Paper ref={panelRef} className="hero-card" shadow="lg" radius="lg" p="md" withBorder>
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={4} style={{ minWidth: 0 }}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.18em' }}>
              React + Vite + Leaflet
            </Text>
            <Title order={1} size="h2">
              DG Mapper
            </Title>
            <Text size="sm" c="dimmed" maw={480}>
              A polished, installable map app with a smooth, slippy map experience.
            </Text>

            {/* TEMPORARY: stands in for real course selection/management UI, which
                doesn't exist yet — see useDefaultCourse.ts. */}
            {isLoggedIn ? (
              <Text size="sm" c={courseError ? 'red' : 'dimmed'}>
                {courseError
                  ? `Couldn't load your course: ${courseError}`
                  : courseLoading
                    ? 'Setting up your course…'
                    : course
                      ? `Course: ${course.name}`
                      : null}
              </Text>
            ) : null}
          </Stack>

          <Stack align="flex-end" gap="sm">
            <ActionIcon variant="subtle" radius="xl" onClick={() => setPanelOpen(false)} aria-label="Collapse panel">
              <IconX size={18} />
            </ActionIcon>

            <Stack gap={4} align="flex-end">
              {locationError ? (
                <Text size="sm" c="red">
                  {locationError}
                </Text>
              ) : null}
              {!locationError && !isLocating && position ? (
                <Text size="sm" c="dimmed">
                  Your location is now shown on the map: {position[0].toFixed(5)}, {position[1].toFixed(5)}
                </Text>
              ) : null}
            </Stack>
          </Stack>
        </Group>
      </Paper>

      <section className="map-card" aria-label="Leaflet map">
        {!panelOpen ? (
          <Stack gap={6} className="main-menu-button-wrapper">
            <Button
              className="main-menu-button"
              radius="xl"
              leftSection={<IconMenu2 size={16} />}
              onClick={() => setPanelOpen(true)}
              aria-label="Open panel"
              title="Open DG Mapper panel"
            >
              DG Mapper
            </Button>

            {/* TEMPORARY: stands in for real course selection/management UI — see
                useDefaultCourse.ts. Mirrors the status text inside the hero panel,
                so it's visible in both the collapsed and expanded states. */}
            {isLoggedIn ? (
              <Badge
                color={courseError ? 'red' : 'gray'}
                variant="light"
                radius="sm"
                style={{ alignSelf: 'flex-start' }}
              >
                {courseError
                  ? `Course error: ${courseError}`
                  : courseLoading
                    ? 'Setting up course…'
                    : (course?.name ?? '')}
              </Badge>
            ) : null}
          </Stack>
        ) : null}

        {isOwner ? (
          <SegmentedControl
            className="edit-mode-toggle"
            size="xs"
            radius="xl"
            value={isEditMode ? 'edit' : 'view'}
            onChange={(value) => setEditModeRequested(value === 'edit')}
            data={[
              {
                value: 'view',
                label: (
                  <Group gap={4} wrap="nowrap">
                    <IconEye size={14} />
                    <span>View</span>
                  </Group>
                ),
              },
              {
                value: 'edit',
                label: (
                  <Group gap={4} wrap="nowrap">
                    <IconEdit size={14} />
                    <span>Edit</span>
                  </Group>
                ),
              },
            ]}
          />
        ) : null}

        <MapControls
          isLoggedIn={isLoggedIn}
          handleLogout={handleLogout}
          openLoginDialog={() => {
            setAuthMode('login')
            setAuthError('')
            setAuthNotice('')
            setShowLoginDialog(true)
          }}
          user={user}
        />

        {/* TEMPORARY: exercises the data layer through the UI before the real
            long-press add-point flow exists. Remove once that flow is built. */}
        {isEditMode ? (
          <ActionIcon
            className="test-add-point-button"
            size={52}
            radius="xl"
            variant="filled"
            color="teal"
            onClick={handleAddTestPoint}
            aria-label="Add test point at map center"
            title="TEMP: add a test point at map center"
          >
            <IconPlus size={22} />
          </ActionIcon>
        ) : null}

        <AuthDialog
          showLoginDialog={showLoginDialog}
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
              }
            }}
          />
        ) : null}

        <MapContainer
          ref={mapRef}
          center={position}
          zoom={13}
          scrollWheelZoom="center"
          touchZoom="center"
          zoomControl={false}
          maxZoom={23}
        >
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
          <RecenterOnCourseHQ course={course} />
          
          <MapInteractions />

          <MapOverlay
            layers={tileLayers}
            mapLayer={mapLayer}
            setMapLayer={setMapLayer}
            locateUser={locateUser}
            position="top-left"
            orientation="vertical"
          />

          <CourseLayer points={points} holes={holes} removePoint={removePoint} isEditMode={isEditMode} />

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

        {/* Fixed at screen center — marks where the temporary add-point button (and
            eventually the real long-press add flow) will place a new point. Deliberately
            outside the Leaflet DOM tree: it never needs to move with the map, so it
            doesn't need Leaflet's coordinate system at all. Only meaningful in edit
            mode — there's nothing to place it for in view mode. */}
        {isEditMode ? (
          <div className="crosshair" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 28 28">
              <g style={{ filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,0.85))' }}>
                <line x1="14" y1="1" x2="14" y2="10" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <line x1="14" y1="18" x2="14" y2="27" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <line x1="1" y1="14" x2="10" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <line x1="18" y1="14" x2="27" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <circle cx="14" cy="14" r="1.5" fill="white" />
              </g>
            </svg>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default App