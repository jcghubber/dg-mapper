import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.js'
import { theme } from './theme.js'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <Notifications position="bottom-right" />
        <App />
      </MantineProvider>
    </StrictMode>,
  )
}
