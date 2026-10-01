import { useContext, type Dispatch } from 'react'
import { EditModeDispatchContext, EditModeStateContext } from '../context/editModeContexts.js'
import type { EditMode, EditModeAction } from '../context/editModeTypes.js'

export function useEditModeState(): EditMode {
  const ctx = useContext(EditModeStateContext)
  if (!ctx) throw new Error('useEditModeState must be used within an EditModeProvider')
  return ctx
}

export function useEditModeDispatch(): Dispatch<EditModeAction> {
  const ctx = useContext(EditModeDispatchContext)
  if (!ctx) throw new Error('useEditModeDispatch must be used within an EditModeProvider')
  return ctx
}
