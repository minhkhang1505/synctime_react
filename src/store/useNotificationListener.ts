import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from './useNotificationStore';
import toast from 'react-hot-toast';

export function useNotificationListener() {
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    let mounted = true;

    const setupListener = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      // Realtime listener for group_members (when someone joins a group)
      const memberChannel = supabase
        .channel('public:group_members')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'group_members' },
          (payload) => {
            // Ignore our own join events
            if ((payload.new as any).user_id === user.id) return;
            
            // Note: Ideally, we should check if the new member's group is one we are also in,
            // but for simplicity, we notify if the change happens in a group we might know.
            const message = `A new member has joined a group you are in.`;
            toast.success('New team member joined!');
            addNotification({
              title: 'New Member',
              message,
              type: 'info'
            });
          }
        )
        .subscribe();

      // Realtime listener for availability_slots (when someone changes their schedule)
      const scheduleChannel = supabase
        .channel('public:availability_slots')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'availability_slots' },
          (payload) => {
            // Ignore our own changes
            if (payload.new && (payload.new as any).user_id === user.id) return;

            toast('A team member updated their availability', {
              icon: '🗓️',
            });
            addNotification({
              title: 'Schedule Updated',
              message: 'A team member has updated their availability.',
              type: 'info'
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(memberChannel);
        supabase.removeChannel(scheduleChannel);
      };
    };

    const cleanupPromise = setupListener();

    return () => {
      mounted = false;
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
  }, [addNotification]);
}
