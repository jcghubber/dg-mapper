import type { User } from '@supabase/supabase-js'
import { ActionIcon, Menu, Text } from '@mantine/core'
import { IconLogin, IconLogout, IconUser } from '@tabler/icons-react'
import './MapControls.css'

type MapControlsProps = {
  isLoggedIn: boolean
  handleLogout: () => void
  openLoginDialog: () => void
  user: User | null
}

function MapControls({ isLoggedIn, handleLogout, openLoginDialog, user }: MapControlsProps) {
  if (!isLoggedIn) {
    return (
      <ActionIcon
        className="map-login-button"
        size={52}
        radius="xl"
        variant="filled"
        onClick={openLoginDialog}
        aria-label="Log in"
        title="Log in"
      >
        <IconLogin size={22} />
      </ActionIcon>
    )
  }

  return (
    <Menu shadow="md" width={220} position="bottom-end" withinPortal zIndex={2000}>
      <Menu.Target>
        <ActionIcon
          className="map-login-button"
          size={52}
          radius="xl"
          variant="filled"
          aria-label="Open user menu"
          title="Open user menu"
        >
          <IconUser size={22} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>
          <Text size="xs" truncate="end">
            Signed in as {user?.email ?? 'Account'}
          </Text>
        </Menu.Label>
        <Menu.Item leftSection={<IconLogout size={16} />} onClick={handleLogout}>
          Sign out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

export default MapControls
