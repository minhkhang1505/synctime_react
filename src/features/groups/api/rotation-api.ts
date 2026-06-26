import { supabase } from '../../../lib/supabase';

export interface RotationLog {
  id: string;
  group_id: string;
  user_id: string;
  tracked_date: string; // YYYY-MM-DD
  notes: string | null;
  tracked_at: string; // ISO timestamp
  created_at: string; // ISO timestamp
  profiles?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

// Track whether we should use localStorage fallback due to table not existing
let useLocalFallback = false;

// Check if error is due to missing relation/table (code '42P01')
function isTableMissingError(error: any): boolean {
  return error && (error.code === '42P01' || (error.message && error.message.includes('relation "rotation_logs" does not exist')));
}

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
        console.warn('rotation_logs table not found in Supabase. Falling back to local storage.');
        useLocalFallback = true;
        return getLocalLogs(groupId);
      }
      throw error;
    }

    return data as RotationLog[];
  } catch (err) {
    console.error('Supabase fetch failed, falling back to local storage:', err);
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
    console.error('Supabase save failed, falling back to local storage:', err);
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
    console.error('Supabase delete failed, falling back to local storage:', err);
    deleteLocalLog(logId, groupId);
  }
}

// Local Storage Fallback implementation details
function getLocalLogs(groupId: string): RotationLog[] {
  const stored = localStorage.getItem(`rotation_logs_${groupId}`);
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
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(),
    group_id: groupId,
    user_id: userId,
    tracked_date: dateStr,
    notes: notes || null,
    tracked_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    profiles: null // Will be resolved dynamically by matching group members in the UI
  };
  logs.unshift(newLog);
  localStorage.setItem(`rotation_logs_${groupId}`, JSON.stringify(logs));
}

function deleteLocalLog(logId: string, groupId: string) {
  const logs = getLocalLogs(groupId);
  const filtered = logs.filter(l => l.id !== logId);
  localStorage.setItem(`rotation_logs_${groupId}`, JSON.stringify(filtered));
}

export function isRotationLocalOnly(): boolean {
  return useLocalFallback;
}
