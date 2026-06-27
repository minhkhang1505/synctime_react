import { useEffect } from 'react';
import { useNotificationStore } from '../store/useNotificationStore';
import { Check, Trash2, Bell } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';

export function Notifications() {
  const { 
    notifications, 
    isLoading, 
    fetchNotifications, 
    markAsRead, 
    markAllAsRead, 
    clearNotifications 
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent flex items-center gap-3">
            <Bell className="text-blue-400" size={32} />
            Notifications
          </h1>
          <p className="text-gray-400 mt-2">Stay updated with your group activities</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => markAllAsRead()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition-all border border-white/5"
            disabled={notifications.length === 0}
          >
            <Check size={18} />
            <span className="text-sm font-medium">Mark all read</span>
          </button>
          <button
            onClick={() => clearNotifications()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all border border-red-500/10"
            disabled={notifications.length === 0}
          >
            <Trash2 size={18} />
            <span className="text-sm font-medium">Clear all</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 glass rounded-3xl border border-white/5">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Bell className="text-gray-500" size={24} />
            </div>
            <h3 className="text-xl font-semibold text-gray-300">No notifications yet</h3>
            <p className="text-gray-500 mt-2">You're all caught up!</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => markAsRead(notification.id)}
              className={cn(
                "p-5 rounded-2xl border transition-all cursor-pointer group flex items-start gap-4",
                notification.read
                  ? "bg-white/5 border-white/5 opacity-70"
                  : "bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/20 shadow-lg shadow-blue-500/5 hover:border-blue-500/40"
              )}
            >
              <div className={cn(
                "w-2 h-2 rounded-full mt-2 shrink-0",
                notification.read ? "bg-transparent" : "bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]"
              )} />
              <div className="flex-1">
                <h4 className={cn(
                  "font-semibold text-lg mb-1",
                  notification.read ? "text-gray-300" : "text-white"
                )}>
                  {notification.title}
                </h4>
                <p className="text-gray-400 text-sm leading-relaxed">{notification.message}</p>
                <div className="text-xs text-gray-500 mt-3 font-medium">
                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
