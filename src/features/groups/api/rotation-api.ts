import { supabase } from '../../../lib/supabase';

export interface RotationGroup {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface RotationProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface RotationGroupMember {
  group_id: string;
  user_id: string;
  joined_at: string;
  profiles: RotationProfile;
}

export interface RotationLog {
  id: string;
  group_id: string;
  user_id: string;
  tracked_date: string; // YYYY-MM-DD
  notes: string | null;
  tracked_at: string; // ISO timestamp
  created_at: string; // ISO timestamp
  profiles?: RotationProfile | null;
}

// Track whether we should use localStorage fallback due to tables not existing
let useLocalFallback = false;

// Check if error is due to missing relation/table (code '42P01')
function isTableMissingError(error: any): boolean {
  return error && (error.code === '42P01' || (error.message && error.message.includes('relation') && error.message.includes('does not exist')));
}

export function isRotationLocalOnly(): boolean {
  return useLocalFallback;
}

// ----------------------------------------------------
// GROUPS API
// ----------------------------------------------------

export async function fetchUserRotationGroups(): Promise<RotationGroup[]> {
  if (useLocalFallback) {
    return getLocalGroups();
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('rotation_groups')
      .select('*, rotation_members!inner(user_id)')
      .eq('rotation_members.user_id', user.id);

    if (error) {
      if (isTableMissingError(error)) {
        console.warn('rotation_groups table not found. Falling back to local storage.');
        useLocalFallback = true;
        return getLocalGroups();
      }
      throw error;
    }

    return data as RotationGroup[];
  } catch (err) {
    console.error('Supabase groups fetch failed, falling back to local storage:', err);
    useLocalFallback = true;
    return getLocalGroups();
  }
}

export async function createRotationGroup(name: string): Promise<RotationGroup> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (useLocalFallback) {
    return createLocalGroup(name, user.id);
  }

  try {
    const { data: group, error: groupErr } = await supabase
      .from('rotation_groups')
      .insert([{ name }])
      .select()
      .single();

    if (groupErr) {
      if (isTableMissingError(groupErr)) {
        useLocalFallback = true;
        return createLocalGroup(name, user.id);
      }
      throw groupErr;
    }

    const { error: memberErr } = await supabase
      .from('rotation_members')
      .insert([{ group_id: group.id, user_id: user.id }]);

    if (memberErr) throw memberErr;

    return group as RotationGroup;
  } catch (err) {
    console.error('Supabase group creation failed, falling back to local storage:', err);
    useLocalFallback = true;
    return createLocalGroup(name, user.id);
  }
}

export async function joinRotationGroup(inviteCode: string): Promise<RotationGroup> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const cleanCode = inviteCode.replace(/\s+/g, '').toLowerCase();

  if (useLocalFallback) {
    return joinLocalGroup(cleanCode, user.id);
  }

  try {
    const { data: group, error: findError } = await supabase
      .from('rotation_groups')
      .select('*')
      .eq('invite_code', cleanCode)
      .single();

    if (findError) {
      if (isTableMissingError(findError)) {
        useLocalFallback = true;
        return joinLocalGroup(cleanCode, user.id);
      }
      throw new Error('Rotation group not found or invalid invite code');
    }

    const { error: joinError } = await supabase
      .from('rotation_members')
      .insert([{ group_id: group.id, user_id: user.id }]);

    if (joinError && joinError.code !== '23505') { // 23505: unique constraint violation
      throw joinError;
    }

    return group as RotationGroup;
  } catch (err: any) {
    if (err.message && err.message.includes('not found')) throw err;
    console.error('Supabase group join failed, falling back to local storage:', err);
    useLocalFallback = true;
    return joinLocalGroup(cleanCode, user.id);
  }
}

// ----------------------------------------------------
// MEMBERS API
// ----------------------------------------------------

export async function fetchRotationGroupMembers(groupId: string): Promise<RotationGroupMember[]> {
  if (useLocalFallback) {
    return getLocalGroupMembers(groupId);
  }

  try {
    const { data, error } = await supabase
      .from('rotation_members')
      .select(`
        group_id,
        user_id,
        joined_at,
        profiles (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('group_id', groupId);

    if (error) {
      if (isTableMissingError(error)) {
        useLocalFallback = true;
        return getLocalGroupMembers(groupId);
      }
      throw error;
    }

    return data as any[];
  } catch (err) {
    console.error('Supabase members fetch failed, falling back to local storage:', err);
    return getLocalGroupMembers(groupId);
  }
}

export async function addRotationMockMember(groupId: string, fullName: string): Promise<void> {
  // Mock members are only available in LocalStorage mode
  if (!useLocalFallback) {
    throw new Error('Adding custom mock members is only supported in offline (local) mode.');
  }
  const mockId = 'mock-' + Math.random().toString(36).substring(2, 9);
  const members = getRawLocalMembers();
  const newMember: RotationGroupMember = {
    group_id: groupId,
    user_id: mockId,
    joined_at: new Date().toISOString(),
    profiles: {
      id: mockId,
      full_name: fullName,
      avatar_url: null
    }
  };
  members.push(newMember);
  localStorage.setItem('rotation_members_local', JSON.stringify(members));
}

// ----------------------------------------------------
// LOGS API
// ----------------------------------------------------

export async function fetchRotationLogs(groupId: string): Promise<RotationLog[]> {
  if (useLocalFallback) {
    return getLocalLogs(groupId);
  }

  try {
    const { data, error } = await supabase
      .from('rotation_logs')
      .select(`
        *,
        profiles (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('group_id', groupId)
      .order('tracked_at', { ascending: false });

    if (error) {
      if (isTableMissingError(error)) {
        useLocalFallback = true;
        return getLocalLogs(groupId);
      }
      throw error;
    }

    return data as RotationLog[];
  } catch (err) {
    console.error('Supabase logs fetch failed, falling back to local storage:', err);
    return getLocalLogs(groupId);
  }
}

export async function saveRotationLog(
  groupId: string,
  dateStr: string,
  notes: string,
  targetUserId?: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const userIdToSave = targetUserId || user.id;

  if (useLocalFallback) {
    saveLocalLog(groupId, userIdToSave, dateStr, notes);
    return;
  }

  try {
    const { error } = await supabase
      .from('rotation_logs')
      .insert([{
        group_id: groupId,
        user_id: userIdToSave,
        tracked_date: dateStr,
        notes: notes || null
      }]);

    if (error) {
      if (isTableMissingError(error)) {
        useLocalFallback = true;
        saveLocalLog(groupId, userIdToSave, dateStr, notes);
        return;
      }
      throw error;
    }
  } catch (err) {
    console.error('Supabase save log failed, falling back to local storage:', err);
    saveLocalLog(groupId, userIdToSave, dateStr, notes);
  }
}

export async function deleteRotationLog(logId: string, groupId: string): Promise<void> {
  if (useLocalFallback) {
    deleteLocalLog(logId, groupId);
    return;
  }

  try {
    const { error } = await supabase
      .from('rotation_logs')
      .delete()
      .eq('id', logId);

    if (error) {
      if (isTableMissingError(error)) {
        useLocalFallback = true;
        deleteLocalLog(logId, groupId);
        return;
      }
      throw error;
    }
  } catch (err) {
    console.error('Supabase delete log failed, falling back to local storage:', err);
    deleteLocalLog(logId, groupId);
  }
}

export function subscribeToRotationLogs(groupId: string, callback: () => void) {
  if (useLocalFallback) {
    return { unsubscribe: () => {} };
  }
  return supabase
    .channel(`public:rotation_logs:group_id=eq.${groupId}`)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'rotation_logs',
      filter: `group_id=eq.${groupId}` 
    }, () => {
      callback();
    })
    .subscribe();
}

// ----------------------------------------------------
// LOCAL STORAGE HELPERS
// ----------------------------------------------------

function getLocalGroups(): RotationGroup[] {
  const stored = localStorage.getItem('rotation_groups_local');
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

function createLocalGroup(name: string, creatorId: string): RotationGroup {
  const groups = getLocalGroups();
  const newGroup: RotationGroup = {
    id: 'group-' + Math.random().toString(36).substring(2, 9),
    name: name,
    invite_code: 'rot-' + Math.random().toString(36).substring(2, 8),
    created_at: new Date().toISOString()
  };
  groups.push(newGroup);
  localStorage.setItem('rotation_groups_local', JSON.stringify(groups));

  // Auto join as creator
  const members = getRawLocalMembers();
  members.push({
    group_id: newGroup.id,
    user_id: creatorId,
    joined_at: new Date().toISOString(),
    profiles: {
      id: creatorId,
      full_name: 'You (Creator)',
      avatar_url: null
    }
  });
  localStorage.setItem('rotation_members_local', JSON.stringify(members));

  return newGroup;
}

function joinLocalGroup(inviteCode: string, userId: string): RotationGroup {
  const groups = getLocalGroups();
  const group = groups.find(g => g.invite_code === inviteCode);
  if (!group) throw new Error('Rotation group not found locally');

  const members = getRawLocalMembers();
  const alreadyJoined = members.some(m => m.group_id === group.id && m.user_id === userId);
  
  if (!alreadyJoined) {
    members.push({
      group_id: group.id,
      user_id: userId,
      joined_at: new Date().toISOString(),
      profiles: {
        id: userId,
        full_name: 'You',
        avatar_url: null
      }
    });
    localStorage.setItem('rotation_members_local', JSON.stringify(members));
  }

  return group;
}

function getRawLocalMembers(): RotationGroupMember[] {
  const stored = localStorage.getItem('rotation_members_local');
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

function getLocalGroupMembers(groupId: string): RotationGroupMember[] {
  const members = getRawLocalMembers();
  return members.filter(m => m.group_id === groupId);
}

function getLocalLogs(groupId: string): RotationLog[] {
  const stored = localStorage.getItem(`rotation_logs_v2_${groupId}`);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

function saveLocalLog(groupId: string, userId: string, dateStr: string, notes: string) {
  const logs = getLocalLogs(groupId);
  const newLog: RotationLog = {
    id: 'log-' + Math.random().toString(36).substring(2, 9),
    group_id: groupId,
    user_id: userId,
    tracked_date: dateStr,
    notes: notes || null,
    tracked_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    profiles: null
  };
  logs.unshift(newLog);
  localStorage.setItem(`rotation_logs_v2_${groupId}`, JSON.stringify(logs));
}

function deleteLocalLog(logId: string, groupId: string) {
  const logs = getLocalLogs(groupId);
  const filtered = logs.filter(l => l.id !== logId);
  localStorage.setItem(`rotation_logs_v2_${groupId}`, JSON.stringify(filtered));
}
