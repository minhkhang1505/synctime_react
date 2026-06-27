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
  role: 'owner' | 'admin' | 'member';
  profiles: RotationProfile;
}

export interface Expense {
  id: string;
  group_id: string;
  title: string;
  amount: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  profiles?: RotationProfile | null; // Creator profile
}

export interface PaymentLog {
  id: string;
  expense_id: string;
  user_id: string;
  paid_at: string;
  note: string | null;
  created_at: string;
  profiles?: RotationProfile | null; // Payer profile
}

// Track whether we should use localStorage fallback due to tables not existing
let useLocalFallback = false;

// Check if error is due to missing relation/table (code '42P01')
function isTableMissingError(error: any): boolean {
  if (!error) return false;
  const code = error.code || (error.pg_error_code) || '';
  const message = error.message || '';
  return code === '42P01' || 
         message.includes('relation') && message.includes('does not exist') ||
         message.includes('42P01');
}

export function isRotationLocalOnly(): boolean {
  return useLocalFallback;
}

// ----------------------------------------------------
// UNIFIED GROUPS AND MEMBERS API (Using main tables)
// ----------------------------------------------------

export async function fetchUserRotationGroups(): Promise<RotationGroup[]> {
  if (useLocalFallback) {
    return getLocalGroups();
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Query unified groups using group_members
    const { data: memberships, error: memberError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    if (memberError) {
      if (isTableMissingError(memberError)) {
        console.warn('group_members table not found. Falling back to local storage.');
        useLocalFallback = true;
        return getLocalGroups();
      }
      throw memberError;
    }

    if (!memberships || memberships.length === 0) {
      return [];
    }

    const groupIds = memberships.map(m => m.group_id);

    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds);

    if (error) {
      if (isTableMissingError(error)) {
        useLocalFallback = true;
        return getLocalGroups();
      }
      throw error;
    }

    return data as RotationGroup[];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      useLocalFallback = true;
      return getLocalGroups();
    }
    console.error('Supabase groups fetch failed:', err);
    throw err;
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
      .from('groups')
      .insert([{ name, created_by: user.id }])
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
      .from('group_members')
      .insert([{ group_id: group.id, user_id: user.id, role: 'owner' }]);

    if (memberErr) throw memberErr;

    return group as RotationGroup;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      useLocalFallback = true;
      return createLocalGroup(name, user.id);
    }
    console.error('Supabase group creation failed:', err);
    throw err;
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
      .from('groups')
      .select('*')
      .eq('invite_code', cleanCode)
      .single();

    if (findError) {
      if (isTableMissingError(findError)) {
        useLocalFallback = true;
        return joinLocalGroup(cleanCode, user.id);
      }
      throw new Error('Group not found or invalid invite code');
    }

    const { error: joinError } = await supabase
      .from('group_members')
      .insert([{ group_id: group.id, user_id: user.id, role: 'member' }]);

    if (joinError && joinError.code !== '23505') {
      throw joinError;
    }

    return group as RotationGroup;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      useLocalFallback = true;
      return joinLocalGroup(cleanCode, user.id);
    }
    console.error('Supabase group join failed:', err);
    throw err;
  }
}

export async function fetchRotationGroupMembers(groupId: string): Promise<RotationGroupMember[]> {
  if (useLocalFallback) {
    return getLocalGroupMembers(groupId);
  }

  try {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        group_id,
        user_id,
        joined_at,
        role,
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
  } catch (err: any) {
    if (isTableMissingError(err)) {
      useLocalFallback = true;
      return getLocalGroupMembers(groupId);
    }
    console.error('Supabase members fetch failed:', err);
    throw err;
  }
}

export async function addRotationMockMember(groupId: string, fullName: string): Promise<void> {
  if (!useLocalFallback) {
    throw new Error('Adding custom mock members is only supported in offline (local) mode.');
  }
  const mockId = 'mock-' + Math.random().toString(36).substring(2, 9);
  const members = getRawLocalMembers();
  const newMember: RotationGroupMember = {
    group_id: groupId,
    user_id: mockId,
    joined_at: new Date().toISOString(),
    role: 'member',
    profiles: {
      id: mockId,
      full_name: fullName,
      avatar_url: null
    }
  };
  members.push(newMember);
  localStorage.setItem('group_members_local', JSON.stringify(members));
}

// ----------------------------------------------------
// EXPENSES AND PAYMENTS API
// ----------------------------------------------------

export async function fetchExpenses(groupId: string): Promise<Expense[]> {
  if (useLocalFallback) {
    return getLocalExpenses(groupId);
  }

  try {
    const { data, error } = await supabase
      .from('expenses')
      .select(`
        *,
        profiles (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingError(error)) {
        useLocalFallback = true;
        return getLocalExpenses(groupId);
      }
      throw error;
    }

    return data as Expense[];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      useLocalFallback = true;
      return getLocalExpenses(groupId);
    }
    console.error('Supabase expenses fetch failed:', err);
    throw err;
  }
}

export async function createExpense(groupId: string, title: string, amount: number): Promise<Expense> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (useLocalFallback) {
    return saveLocalExpense(groupId, title, amount, user.id);
  }

  try {
    const { data, error } = await supabase
      .from('expenses')
      .insert([{
        group_id: groupId,
        title,
        amount,
        created_by: user.id
      }])
      .select(`
        *,
        profiles (
          id,
          full_name,
          avatar_url
        )
      `)
      .single();

    if (error) {
      if (isTableMissingError(error)) {
        useLocalFallback = true;
        return saveLocalExpense(groupId, title, amount, user.id);
      }
      throw error;
    }

    return data as Expense;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      useLocalFallback = true;
      return saveLocalExpense(groupId, title, amount, user.id);
    }
    console.error('Supabase create expense failed:', err);
    throw err;
  }
}

export async function deleteExpense(expenseId: string, groupId: string): Promise<void> {
  if (useLocalFallback) {
    deleteLocalExpense(expenseId, groupId);
    return;
  }

  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId);

    if (error) {
      if (isTableMissingError(error)) {
        useLocalFallback = true;
        deleteLocalExpense(expenseId, groupId);
        return;
      }
      throw error;
    }
  } catch (err: any) {
    if (isTableMissingError(err)) {
      useLocalFallback = true;
      deleteLocalExpense(expenseId, groupId);
      return;
    }
    console.error('Supabase delete expense failed:', err);
    throw err;
  }
}

export async function fetchPaymentLogs(groupId: string): Promise<PaymentLog[]> {
  if (useLocalFallback) {
    return getLocalPaymentLogs(groupId);
  }

  try {
    // 1. Get expenses IDs for this group
    const { data: expenses, error: expError } = await supabase
      .from('expenses')
      .select('id')
      .eq('group_id', groupId);

    if (expError) {
      if (isTableMissingError(expError)) {
        useLocalFallback = true;
        return getLocalPaymentLogs(groupId);
      }
      throw expError;
    }

    if (!expenses || expenses.length === 0) return [];

    const expenseIds = expenses.map(e => e.id);

    // 2. Get payment logs for those expenses
    const { data, error } = await supabase
      .from('payment_logs')
      .select(`
        *,
        profiles (
          id,
          full_name,
          avatar_url
        )
      `)
      .in('expense_id', expenseIds)
      .order('paid_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as PaymentLog[];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      useLocalFallback = true;
      return getLocalPaymentLogs(groupId);
    }
    console.error('Supabase payment logs fetch failed:', err);
    throw err;
  }
}

export async function markAsPaid(expenseId: string, note?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (useLocalFallback) {
    saveLocalPayment(expenseId, user.id, note);
    return;
  }

  try {
    const { error } = await supabase
      .from('payment_logs')
      .insert([{
        expense_id: expenseId,
        user_id: user.id,
        note: note || null
      }]);

    if (error) {
      if (isTableMissingError(error)) {
        useLocalFallback = true;
        saveLocalPayment(expenseId, user.id, note);
        return;
      }
      throw error;
    }
  } catch (err: any) {
    if (isTableMissingError(err)) {
      useLocalFallback = true;
      saveLocalPayment(expenseId, user.id, note);
      return;
    }
    console.error('Supabase mark as paid failed:', err);
    throw err;
  }
}

export async function unmarkAsPaid(expenseId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (useLocalFallback) {
    deleteLocalPayment(expenseId, user.id);
    return;
  }

  try {
    const { error } = await supabase
      .from('payment_logs')
      .delete()
      .eq('expense_id', expenseId)
      .eq('user_id', user.id);

    if (error) {
      if (isTableMissingError(error)) {
        useLocalFallback = true;
        deleteLocalPayment(expenseId, user.id);
        return;
      }
      throw error;
    }
  } catch (err: any) {
    if (isTableMissingError(err)) {
      useLocalFallback = true;
      deleteLocalPayment(expenseId, user.id);
      return;
    }
    console.error('Supabase unmark as paid failed:', err);
    throw err;
  }
}

export function subscribeToPayments(groupId: string, callback: () => void) {
  if (useLocalFallback) {
    return { unsubscribe: () => {} };
  }
  return supabase
    .channel(`public:payment_logs:group_id=${groupId}`)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'payment_logs'
    }, () => {
      callback();
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'expenses',
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
  const stored = localStorage.getItem('groups_local');
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
    invite_code: 'grp-' + Math.random().toString(36).substring(2, 8),
    created_at: new Date().toISOString()
  };
  groups.push(newGroup);
  localStorage.setItem('groups_local', JSON.stringify(groups));

  const members = getRawLocalMembers();
  members.push({
    group_id: newGroup.id,
    user_id: creatorId,
    joined_at: new Date().toISOString(),
    role: 'owner',
    profiles: {
      id: creatorId,
      full_name: 'You (Owner)',
      avatar_url: null
    }
  });
  localStorage.setItem('group_members_local', JSON.stringify(members));

  return newGroup;
}

function joinLocalGroup(inviteCode: string, userId: string): RotationGroup {
  const groups = getLocalGroups();
  const group = groups.find(g => g.invite_code === inviteCode);
  if (!group) throw new Error('Group not found locally');

  const members = getRawLocalMembers();
  const alreadyJoined = members.some(m => m.group_id === group.id && m.user_id === userId);
  
  if (!alreadyJoined) {
    members.push({
      group_id: group.id,
      user_id: userId,
      joined_at: new Date().toISOString(),
      role: 'member',
      profiles: {
        id: userId,
        full_name: 'You',
        avatar_url: null
      }
    });
    localStorage.setItem('group_members_local', JSON.stringify(members));
  }

  return group;
}

function getRawLocalMembers(): RotationGroupMember[] {
  const stored = localStorage.getItem('group_members_local');
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

function getLocalExpenses(groupId: string): Expense[] {
  const stored = localStorage.getItem(`expenses_local_${groupId}`);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

function saveLocalExpense(groupId: string, title: string, amount: number, creatorId: string): Expense {
  const expenses = getLocalExpenses(groupId);
  const newExpense: Expense = {
    id: 'expense-' + Math.random().toString(36).substring(2, 9),
    group_id: groupId,
    title,
    amount,
    created_by: creatorId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    profiles: {
      id: creatorId,
      full_name: 'You',
      avatar_url: null
    }
  };
  expenses.unshift(newExpense);
  localStorage.setItem(`expenses_local_${groupId}`, JSON.stringify(expenses));
  return newExpense;
}

function deleteLocalExpense(expenseId: string, groupId: string) {
  const expenses = getLocalExpenses(groupId);
  const filtered = expenses.filter(e => e.id !== expenseId);
  localStorage.setItem(`expenses_local_${groupId}`, JSON.stringify(filtered));

  // Also clean up payment logs
  const payments = getLocalPaymentLogs(groupId);
  const filteredPayments = payments.filter(p => p.expense_id !== expenseId);
  localStorage.setItem(`payment_logs_local_${groupId}`, JSON.stringify(filteredPayments));
}

function getLocalPaymentLogs(groupId: string): PaymentLog[] {
  const stored = localStorage.getItem(`payment_logs_local_${groupId}`);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

function saveLocalPayment(expenseId: string, userId: string, note?: string): PaymentLog {
  // Find group ID from expenseId locally
  // We can look at localStorage keys to find which group has this expense
  let groupId = '';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('expenses_local_')) {
      const expenses: Expense[] = JSON.parse(localStorage.getItem(key) || '[]');
      if (expenses.some(e => e.id === expenseId)) {
        groupId = key.replace('expenses_local_', '');
        break;
      }
    }
  }

  if (!groupId) throw new Error('Expense not found locally');

  const payments = getLocalPaymentLogs(groupId);
  // Ensure no duplicate payment log
  const exists = payments.some(p => p.expense_id === expenseId && p.user_id === userId);
  if (exists) return payments.find(p => p.expense_id === expenseId && p.user_id === userId)!;

  const newPayment: PaymentLog = {
    id: 'pay-' + Math.random().toString(36).substring(2, 9),
    expense_id: expenseId,
    user_id: userId,
    paid_at: new Date().toISOString(),
    note: note || null,
    created_at: new Date().toISOString(),
    profiles: {
      id: userId,
      full_name: 'You',
      avatar_url: null
    }
  };
  payments.unshift(newPayment);
  localStorage.setItem(`payment_logs_local_${groupId}`, JSON.stringify(payments));
  return newPayment;
}

function deleteLocalPayment(expenseId: string, userId: string) {
  let groupId = '';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('expenses_local_')) {
      const expenses: Expense[] = JSON.parse(localStorage.getItem(key) || '[]');
      if (expenses.some(e => e.id === expenseId)) {
        groupId = key.replace('expenses_local_', '');
        break;
      }
    }
  }

  if (!groupId) return;

  const payments = getLocalPaymentLogs(groupId);
  const filtered = payments.filter(p => !(p.expense_id === expenseId && p.user_id === userId));
  localStorage.setItem(`payment_logs_local_${groupId}`, JSON.stringify(filtered));
}
