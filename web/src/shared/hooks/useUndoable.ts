import { useCallback, useReducer } from "react";

const LIMIT = 100;

interface State<T> {
  past: T[];
  present: T;
  future: T[];
  /** Last saved/loaded value; `dirty` compares by reference against it. */
  base: T;
}

type Action<T> =
  | { type: "set"; next: T }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; value: T };

function reducer<T>(state: State<T>, action: Action<T>): State<T> {
  switch (action.type) {
    case "set":
      if (action.next === state.present) return state;
      return {
        ...state,
        past: [...state.past, state.present].slice(-LIMIT),
        present: action.next,
        future: [],
      };
    case "undo": {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        ...state,
        past: state.past.slice(0, -1),
        present: prev,
        future: [state.present, ...state.future],
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return { ...state, past: [...state.past, state.present], present: next, future: rest };
    }
    case "reset":
      return { past: [], present: action.value, future: [], base: action.value };
    default:
      return state;
  }
}

export interface Undoable<T> {
  value: T;
  /** Last loaded/saved value (start of the current history). */
  base: T;
  set: (next: T) => void;
  undo: () => void;
  redo: () => void;
  reset: (value: T) => void;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
}

/** Value with an undo/redo history; `reset` starts a new history (after load or save). */
export function useUndoable<T>(initial: T): Undoable<T> {
  const [state, dispatch] = useReducer(
    reducer as (s: State<T>, a: Action<T>) => State<T>,
    { past: [], present: initial, future: [], base: initial },
  );
  const set = useCallback((next: T) => dispatch({ type: "set", next }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const reset = useCallback((value: T) => dispatch({ type: "reset", value }), []);
  return {
    value: state.present,
    base: state.base,
    set,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    dirty: state.present !== state.base,
  };
}
