import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from './useNotificationStore';
import toast from 'react-hot-toast';

// Debounce map outside the component so it persists across re-renders
const pendingNotifications = new Map<string, ReturnType<typeof setTimeout>>();

export function useNotificationListener() {
  const { addNotification } = useNotificationStore();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const fetchDetails = async (userId: string, groupId: string) => {
      try {
        const [{ data: profile }, { data: group }] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', userId).single(),
          supabase.from('groups').select('name').eq('id', groupId).single()
        ]);
        return {
          userName: profile?.full_name || 'A team member',
          groupName: group?.name || 'a group'
        };
      } catch (err) {
        return { userName: 'A team member', groupName: 'a group' };
      }
    };

    const setupListener = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted.current) return;

      // Realtime listener for group_members (when someone joins a group)
      const memberChannel = supabase
        .channel('public:group_members')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'group_members' },
          async (payload) => {
            const newRow = payload.new as any;
            if (!newRow || newRow.user_id === user.id) return;
            
            const { userName, groupName } = await fetchDetails(newRow.user_id, newRow.group_id);
            if (!mounted.current) return;

            toast.success(`${userName} joined ${groupName}!`);
            addNotification({
              title: 'New Member Joined',
              message: `${userName} has just joined the group "${groupName}". Say hi!`,
              type: 'info' // keep info or success
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
            const row = payload.new as any;
            if (!row || row.user_id === user.id) return; // ignore deletes and self updates

            const key = `${row.user_id}-${row.group_id}`;
            
            if (pendingNotifications.has(key)) {
              clearTimeout(pendingNotifications.get(key)!);
            }

            pendingNotifications.set(key, setTimeout(async () => {
              pendingNotifications.delete(key);
              
              const { userName, groupName } = await fetchDetails(row.user_id, row.group_id);
              if (!mounted.current) return;

              toast(`${userName} updated their availability in ${groupName}`, {
                icon: '🗓️',
              });
              addNotification({
                title: 'Schedule Updated',
                message: `${userName} recently updated their availability in "${groupName}".`,
                type: 'info'
              });
            }, 2500)); // wait 2.5s to debounce multiple slot updates
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
      mounted.current = false;
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
  }, [addNotification]);
}
