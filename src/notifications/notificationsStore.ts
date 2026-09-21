import { create } from 'zustand'
import { api, type NotificationRecord } from '../api/client'

interface NotificationsState {
  items: NotificationRecord[]
  unread: number
  loaded: boolean
  loading: boolean
  open: boolean
  setOpen: (open: boolean) => void
  load: () => Promise<void>
  refreshUnread: () => Promise<void>
  markRead: (id: number) => Promise<void>
  markAllRead: () => Promise<void>
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unread: 0,
  loaded: false,
  loading: false,
  open: false,

  setOpen: (open) => {
    set({ open })
    if (open) void get().load()
  },

  load: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const data = await api.notifications.list()
      set({ items: data.notifications, unread: data.unread, loaded: true })
    } catch {
      /* keep previous state */
    } finally {
      set({ loading: false })
    }
  },

  refreshUnread: async () => {
    try {
      const data = await api.notifications.unread()
      set({ unread: data.count })
    } catch {
      /* ignore transient failures */
    }
  },

  markRead: async (id) => {
    const optimistic = get().items.map((n) => (n.id === id ? { ...n, read: true } : n))
    set({ items: optimistic })
    try {
      const data = await api.notifications.markRead(id)
      set({ unread: data.unread })
    } catch {
      void get().load()
    }
  },

  markAllRead: async () => {
    set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })), unread: 0 }))
    try {
      await api.notifications.markAllRead()
    } catch {
      void get().load()
    }
  },
}))