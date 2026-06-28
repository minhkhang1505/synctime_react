import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from './useNotificationStore';
import toast from 'react-hot-toast';

export function useNotificationListener() {
  const { fetchNotifications } = useNotificationStore();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    // Fetch initial list of notifications from DB
    fetchNotifications();

    const setupListener = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted.current) return;

      // Subscribe directly to the unified notifications table for this user
      const channel = supabase
        .channel(`public:notifications:user_id=eq.${user.id}`)
        .on(
          'postgres_changes',
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications', 
            filter: `user_id=eq.${user.id}` 
          },
          async (payload) => {
            const newRow = payload.new as any;
            if (!newRow || !mounted.current) return;

            // Trigger a refresh of the notification store list
            await fetchNotifications();

            // Extract display values from pre-resolved payload
            const notifyType = newRow.type;
            const meta = newRow.payload || {};
            const userName = meta.userName || 'Một thành viên';
            const groupName = meta.groupName || 'nhóm';
            const expenseTitle = meta.expenseTitle || 'chi phí';

            // Show real-time desktop toast alerts
            if (notifyType === 'USER_JOINED') {
              toast.success(`${userName} đã tham gia ${groupName}!`);
            } else if (notifyType === 'USER_LEFT') {
              toast(`${userName} đã rời khỏi ${groupName}`, {
                icon: '👋',
              });
            } else if (notifyType === 'AVAILABLE_UPDATED') {
              toast(`${userName} đã cập nhật lịch rảnh trong ${groupName}`, {
                icon: '🗓️',
              });
            } else if (notifyType === 'PAYMENT_MARKED') {
              toast.success(`${userName} đã hoàn tất thanh toán cho "${expenseTitle}"!`);
            } else if (notifyType === 'EXPENSE_TRACKED') {
              toast.success(`${userName} đã ghi nhận chi tiêu "${expenseTitle}"!`, {
                icon: '💵',
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanupPromise = setupListener();

    return () => {
      mounted.current = false;
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
  }, [fetchNotifications]);
}
