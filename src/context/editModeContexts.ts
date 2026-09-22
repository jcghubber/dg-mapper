import { createContext, type Dispatch } from 'react'
import type { EditMode, EditModeAction } from './editModeTypes.js'

export const EditModeStateContext = createContext<EditMode | null>(null)
export const EditModeDispatchContext = createContext<Dispatch<EditModeAction> | null>(null)
