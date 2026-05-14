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
