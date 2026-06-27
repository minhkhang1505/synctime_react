import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

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
  isLoading: boolean;
  addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  unreadCount: () => number;
}

let useDbNotifications = true;

function isTableMissingError(error: any): boolean {
  if (!error) return false;
  const code = error.code || (error.pg_error_code) || '';
  const message = error.message || '';
  return code === '42P01' || 
         message.includes('relation') && message.includes('does not exist') ||
         message.includes('42P01');
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      isLoading: false,
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
            notifications: [newNotification, ...state.notifications].slice(0, 50),
          };
        });
      },
      fetchNotifications: async () => {
        if (!useDbNotifications) return;
        set({ isLoading: true });

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            set({ isLoading: false });
            return;
          }

          const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);

          if (error) {
            if (isTableMissingError(error)) {
              useDbNotifications = false;
              set({ isLoading: false });
              return;
            }
            throw error;
          }

          const mapped: AppNotification[] = (data || []).map(n => ({
            id: n.id,
            title: n.type === 'USER_JOINED' ? 'New Member Joined' :
                   n.type === 'USER_LEFT' ? 'Member Left' :
                   n.type === 'AVAILABLE_UPDATED' ? 'Schedule Updated' : 'Payment Completed',
            message: n.type === 'USER_JOINED' ? `${n.payload.userName || 'A member'} has just joined the group "${n.payload.groupName || 'a group'}". Say hi!` :
                     n.type === 'USER_LEFT' ? `${n.payload.userName || 'A member'} left the group "${n.payload.groupName || 'a group'}".` :
                     n.type === 'AVAILABLE_UPDATED' ? `${n.payload.userName || 'A member'} recently updated their availability in "${n.payload.groupName || 'a group'}".` :
                     `${n.payload.userName || 'A member'} marked payment for "${n.payload.expenseTitle || 'an expense'}".`,
            createdAt: n.created_at,
            read: n.is_read,
            type: n.type === 'PAYMENT_MARKED' ? 'success' : 'info'
          }));

          set({ notifications: mapped, isLoading: false });
        } catch (err) {
          console.error('Failed to fetch notifications from DB:', err);
          set({ isLoading: false });
        }
      },
      markAsRead: async (id) => {
        // Optimistic local update
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));

        if (!useDbNotifications || id.startsWith('local-') || id.length < 10) return;

        try {
          const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

          if (error && isTableMissingError(error)) {
            useDbNotifications = false;
          }
        } catch (err) {
          console.error('Failed to mark notification as read in DB:', err);
        }
      },
      markAllAsRead: async () => {
        // Optimistic local update
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));

        if (!useDbNotifications) return;

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id);

          if (error && isTableMissingError(error)) {
            useDbNotifications = false;
          }
        } catch (err) {
          console.error('Failed to mark all notifications as read in DB:', err);
        }
      },
      clearNotifications: async () => {
        // Optimistic local clear
        set({ notifications: [] });

        if (!useDbNotifications) return;

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('user_id', user.id);

          if (error && isTableMissingError(error)) {
            useDbNotifications = false;
          }
        } catch (err) {
          console.error('Failed to clear notifications in DB:', err);
        }
      },
      unreadCount: () => get().notifications.filter((n) => !n.read).length,
    }),
    {
      name: 'sync-time-notifications',
      partialize: (state) => ({ notifications: state.notifications }), // Only persist notifications array locally
    }
  )
);
