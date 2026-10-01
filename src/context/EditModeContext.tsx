import { useReducer, type ReactNode } from 'react'
import { EditModeDispatchContext, EditModeStateContext } from './editModeContexts.js'
import type { EditMode, EditModeAction } from './editModeTypes.js'

function editModeReducer(state: EditMode, action: EditModeAction): EditMode {
  switch (action.type) {
    case 'START_PLACING':
      // Gated to idle only — matches architecture.md's general pattern of not
      // letting one gesture's long-press double as the trigger for a different
      // flow while another is already in progress.
      if (state.kind !== 'idle') return state
      return { kind: 'placing', latlng: action.latlng }

    case 'CHOOSE_POINT_TYPE':
      if (state.kind !== 'placing') return state
      return { kind: 'naming', latlng: state.latlng, pointType: action.pointType }

    case 'START_BUILDING_FROM_POINT':
      if (state.kind !== 'idle') return state
      return {
        kind: 'building',
        editingHoleId: null,
        selectedTees: action.pointType === 'tee' ? [action.pointId] : [],
        selectedBaskets: action.pointType === 'basket' ? [action.pointId] : [],
      }

    case 'START_EDITING_HOLE':
      if (state.kind !== 'idle') return state
      return {
        kind: 'building',
        editingHoleId: action.holeId,
        selectedTees: action.teeIds,
        selectedBaskets: action.basketIds,
      }

    case 'TOGGLE_POINT_IN_SELECTION': {
      if (state.kind !== 'building') return state
      if (action.pointType === 'tee') {
        const isSelected = state.selectedTees.includes(action.pointId)
        return {
          ...state,
          selectedTees: isSelected
            ? state.selectedTees.filter((id) => id !== action.pointId)
            : [...state.selectedTees, action.pointId],
        }
      }
      const isSelected = state.selectedBaskets.includes(action.pointId)
      return {
        ...state,
        selectedBaskets: isSelected
          ? state.selectedBaskets.filter((id) => id !== action.pointId)
          : [...state.selectedBaskets, action.pointId],
      }
    }

    case 'CANCEL':
    case 'RESET':
      return { kind: 'idle' }

    default:
      return state
  }
}

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [mode, dispatch] = useReducer(editModeReducer, { kind: 'idle' })

  return (
    <EditModeStateContext.Provider value={mode}>
      <EditModeDispatchContext.Provider value={dispatch}>{children}</EditModeDispatchContext.Provider>
    </EditModeStateContext.Provider>
  )
}
