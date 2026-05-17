import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  type: 'info' | 'success' | 'warning';
}

interface NotificationState {
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      addNotification: (notification) => {
        set((state) => {
          // Prevent exact duplicate of the most recent notification
          if (
            state.notifications.length > 0 &&
            state.notifications[0].title === notification.title &&
            state.notifications[0].message === notification.message &&
            !state.notifications[0].read
          ) {
            return state;
          }

          const newNotification: AppNotification = {
            ...notification,
            id: Math.random().toString(36).substring(2, 9),
            createdAt: new Date().toISOString(),
            read: false,
          };
          
          return {
            notifications: [newNotification, ...state.notifications].slice(0, 50), // keep last 50
          };
        });
      },
      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),
      clearNotifications: () => set({ notifications: [] }),
      unreadCount: () => get().notifications.filter((n) => !n.read).length,
    }),
    {
      name: 'sync-time-notifications',
    }
  )
);
