import { create } from 'zustand'
import { api, onAuthFailure, setAuthToken, type AuthUser } from '../api/client'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  hydrate: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (data: object) => Promise<void>
}

let hooked = false

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,

  hydrate: async () => {
    if (!getAuthTokenLocal()) {
      set({ status: 'unauthenticated', user: null })
      return
    }
    try {
      const user = await api.auth.me()
      set({ status: 'authenticated', user })
    } catch {
      setAuthToken(null)
      set({ status: 'unauthenticated', user: null })
    }
  },

  login: async (username, password) => {
    const { token, user } = await api.auth.login(username, password)
    setAuthToken(token)
    set({ status: 'authenticated', user })
  },

  logout: async () => {
    try {
      await api.auth.logout()
    } catch {
      /* token may already be invalid */
    }
    setAuthToken(null)
    set({ status: 'unauthenticated', user: null })
  },

  updateProfile: async (data) => {
    const user = await api.auth.updateProfile(data)
    set({ user })
  },
}))

function getAuthTokenLocal(): string | null {
  try {
    return localStorage.getItem('dcms_token')
  } catch {
    return null
  }
}

// Any 401 while using the app invalidates the session and returns to login.
if (!hooked) {
  hooked = true
  onAuthFailure(() => {
    setAuthToken(null)
    useAuthStore.setState({ status: 'unauthenticated', user: null })
  })
}