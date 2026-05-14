import { supabase } from '../../../lib/supabase';

export interface Group {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  joined_at: string;
  profiles: Profile;
}

export async function fetchUserGroups(): Promise<Group[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('groups')
    .select('*, group_members!inner(user_id)')
    .eq('group_members.user_id', user.id);

  if (error) throw error;
  return data as Group[];
}

export async function createGroup(name: string): Promise<Group> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('groups')
    .insert([{ name }])
    .select()
    .single();

  if (error) throw error;

  const { error: memberError } = await supabase
    .from('group_members')
    .insert([{ group_id: data.id, user_id: user.id }]);
    
  if (memberError) throw memberError;

  return data;
}

export async function joinGroup(inviteCode: string): Promise<Group> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Sanitize the code: remove all spaces and convert to lowercase
  const cleanCode = inviteCode.replace(/\s+/g, '').toLowerCase();

  const { data: group, error: findError } = await supabase
    .from('groups')
    .select('*')
    .eq('invite_code', cleanCode)
    .single();

  if (findError) throw new Error('Group not found or invalid invite code');

  const { error: joinError } = await supabase
    .from('group_members')
    .insert([{ group_id: group.id, user_id: user.id }]);

  if (joinError && joinError.code !== '23505') {
    throw joinError;
  }

  return group;
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      *,
      profiles (
        id, full_name, avatar_url
      )
    `)
    .eq('group_id', groupId);

  if (error) throw error;
  return data as any;
}
