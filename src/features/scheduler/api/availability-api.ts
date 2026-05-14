import { supabase } from '../../../lib/supabase';

export interface AvailabilitySlot {
  id: string;
  user_id: string;
  group_id: string;
  available_date: string;
  start_time: string;
  end_time: string;
}

export async function fetchAvailability(groupId: string): Promise<AvailabilitySlot[]> {
  const { data, error } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('group_id', groupId);

  if (error) throw error;
  return data as AvailabilitySlot[];
}

export async function saveAvailability(groupId: string, slots: { available_date: string, start_time: string, end_time: string }[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error: deleteError } = await supabase
    .from('availability_slots')
    .delete()
    .eq('user_id', user.id)
    .eq('group_id', groupId);
    
  if (deleteError) throw deleteError;

  if (slots.length === 0) return;

  const slotsToInsert = slots.map(s => ({
    ...s,
    user_id: user.id,
    group_id: groupId
  }));

  const { error: insertError } = await supabase
    .from('availability_slots')
    .insert(slotsToInsert);

  if (insertError) throw insertError;
}

export function subscribeToAvailability(groupId: string, callback: () => void) {
  return supabase
    .channel(`public:availability_slots:group_id=eq.${groupId}`)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'availability_slots',
      filter: `group_id=eq.${groupId}` 
    }, () => {
      callback();
    })
    .subscribe();
}

export async function fetchTodayMatches() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get local date string YYYY-MM-DD
  const todayStr = new Date().toLocaleDateString('en-CA');

  // 1. Get user's groups
  const { data: userGroupsData, error: groupErr } = await supabase
    .from('group_members')
    .select('group_id, groups(name)')
    .eq('user_id', user.id);

  if (groupErr || !userGroupsData || userGroupsData.length === 0) return [];

  const groupIds = userGroupsData.map(g => g.group_id);

  // 2. Get member count for these groups
  const { data: memberCountsData } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds);
  
  const groupCounts = memberCountsData?.reduce((acc, curr) => {
    acc[curr.group_id] = (acc[curr.group_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // 3. Get availability for today for these groups
  const { data: availabilityData } = await supabase
    .from('availability_slots')
    .select('group_id, start_time')
    .eq('available_date', todayStr)
    .in('group_id', groupIds);

  // 4. Calculate matches
  const availCounts: Record<string, number> = {};
  availabilityData?.forEach(slot => {
     const key = `${slot.group_id}|${slot.start_time}`;
     availCounts[key] = (availCounts[key] || 0) + 1;
  });

  const timeMatchesMap: Record<string, { timeLabel: string, groups: { id: string, name: string }[] }> = {};
  const TIME_MAP: Record<string, string> = { '08:00:00': 'MORNING', '13:00:00': 'AFTERNOON', '18:00:00': 'EVENING' };

  for (const [key, count] of Object.entries(availCounts)) {
     const [groupId, startTime] = key.split('|');
     if (count === groupCounts[groupId] && count > 1) {
        const group: any = userGroupsData.find(g => g.group_id === groupId)?.groups;
        const groupName = Array.isArray(group) ? group[0]?.name : group?.name || 'Unknown Group';
        const timeLabel = TIME_MAP[startTime] || startTime;

        if (!timeMatchesMap[startTime]) {
           timeMatchesMap[startTime] = { timeLabel, groups: [] };
        }
        
        // Ensure max 2 groups per time block to keep UI clean, or just add them.
        if (timeMatchesMap[startTime].groups.length < 2) {
           timeMatchesMap[startTime].groups.push({ id: groupId, name: groupName });
        }
     }
  }

  const matches = Object.entries(timeMatchesMap)
     .map(([startTime, data]) => ({
        startTime,
        timeLabel: data.timeLabel,
        groups: data.groups
     }))
     .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return matches;
}
