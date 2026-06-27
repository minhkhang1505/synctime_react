import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { 
  fetchUserRotationGroups, 
  createRotationGroup,
  joinRotationGroup,
  fetchRotationGroupMembers, 
  addRotationMockMember,
  fetchExpenses,
  createExpense,
  deleteExpense,
  fetchPaymentLogs,
  markAsPaid,
  unmarkAsPaid,
  subscribeToPayments,
  isRotationLocalOnly,
  Expense
} from '../features/groups/api/rotation-api';
import { format, parseISO } from 'date-fns';
import { 
  CreditCard, 
  Users, 
  Plus, 
  Trash2, 
  Copy, 
  AlertTriangle,
  History,
  UserPlus,
  DollarSign,
  CheckCircle2,
  X,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

export function Rotation() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  
  // Modal states
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isJoinGroupModalOpen, setIsJoinGroupModalOpen] = useState(false);
  const [isCreateExpenseModalOpen, setIsCreateExpenseModalOpen] = useState(false);
  const [isMockMemberModalOpen, setIsMockMemberModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  
  // Forms states
  const [newGroupName, setNewGroupName] = useState('');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [mockMemberName, setMockMemberName] = useState('');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  
  // Active payment state
  const [activeExpenseId, setActiveExpenseId] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState('');

  // 1. Fetch user's groups
  const { data: groups, isLoading: isGroupsLoading } = useQuery({
    queryKey: ['payments_groups'],
    queryFn: fetchUserRotationGroups,
    enabled: !!user
  });

  // Set default group if none selected
  useEffect(() => {
    if (groups && groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  const selectedGroup = groups?.find(g => g.id === selectedGroupId);

  // 2. Fetch members of the selected group
  const { data: members, isLoading: isMembersLoading } = useQuery({
    queryKey: ['payments_members', selectedGroupId],
    queryFn: () => fetchRotationGroupMembers(selectedGroupId),
    enabled: !!selectedGroupId
  });

  // 3. Fetch expenses
  const { data: expenses, isLoading: isExpensesLoading } = useQuery({
    queryKey: ['payments_expenses', selectedGroupId],
    queryFn: () => fetchExpenses(selectedGroupId),
    enabled: !!selectedGroupId
  });

  // 4. Fetch payment logs
  const { data: paymentLogs, isLoading: isPaymentLogsLoading } = useQuery({
    queryKey: ['payments_logs', selectedGroupId],
    queryFn: () => fetchPaymentLogs(selectedGroupId),
    enabled: !!selectedGroupId
  });

  // Real-time subscription to payments and expenses
  useEffect(() => {
    if (!selectedGroupId || isRotationLocalOnly()) return;

    const subscription = subscribeToPayments(selectedGroupId, () => {
      queryClient.invalidateQueries({ queryKey: ['payments_expenses', selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ['payments_logs', selectedGroupId] });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedGroupId, queryClient]);

  // Mutations
  const createGroupMutation = useMutation({
    mutationFn: createRotationGroup,
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries({ queryKey: ['payments_groups'] });
      setSelectedGroupId(newGroup.id);
      setIsCreateGroupModalOpen(false);
      setNewGroupName('');
      toast.success('Payment group created!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create group');
    }
  });

  const joinGroupMutation = useMutation({
    mutationFn: joinRotationGroup,
    onSuccess: (joinedGroup) => {
      queryClient.invalidateQueries({ queryKey: ['payments_groups'] });
      setSelectedGroupId(joinedGroup.id);
      setIsJoinGroupModalOpen(false);
      setJoinInviteCode('');
      toast.success(`Joined group "${joinedGroup.name}"!`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to join group');
    }
  });

  const addMockMemberMutation = useMutation({
    mutationFn: (name: string) => addRotationMockMember(selectedGroupId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments_members', selectedGroupId] });
      setIsMockMemberModalOpen(false);
      setMockMemberName('');
      toast.success('Mock member added locally!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add mock member');
    }
  });

  const addExpenseMutation = useMutation({
    mutationFn: ({ title, amount }: { title: string; amount: number }) => 
      createExpense(selectedGroupId, title, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments_expenses', selectedGroupId] });
      toast.success('Expense created successfully!');
      setIsCreateExpenseModalOpen(false);
      setExpenseTitle('');
      setExpenseAmount('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create expense');
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId: string) => deleteExpense(expenseId, selectedGroupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments_expenses', selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ['payments_logs', selectedGroupId] });
      toast.success('Expense deleted');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete expense');
    }
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ expenseId, note }: { expenseId: string; note?: string }) => 
      markAsPaid(expenseId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments_logs', selectedGroupId] });
      toast.success('Payment recorded successfully!');
      setIsPayModalOpen(false);
      setPaymentNote('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to record payment');
    }
  });

  const unmarkPaidMutation = useMutation({
    mutationFn: (expenseId: string) => unmarkAsPaid(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments_logs', selectedGroupId] });
      toast.success('Payment confirmation removed');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to undo payment');
    }
  });

  const copyInviteCode = () => {
    if (!selectedGroup) return;
    navigator.clipboard.writeText(selectedGroup.invite_code);
    toast.success('Invite code copied!');
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expenseAmount);
    if (!expenseTitle || isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid title and amount');
      return;
    }
    addExpenseMutation.mutate({ title: expenseTitle, amount: amountNum });
  };

  const handleOpenPayModal = (expenseId: string) => {
    setActiveExpenseId(expenseId);
    setPaymentNote('');
    setIsPayModalOpen(true);
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExpenseId) return;
    markPaidMutation.mutate({ expenseId: activeExpenseId, note: paymentNote });
  };

  // Helper to map profiles
  const getProfileForLog = (userId: string) => {
    const member = members?.find(m => m.user_id === userId);
    if (member) return member.profiles;
    return {
      id: userId,
      full_name: userId === user?.id ? 'You' : 'Unknown Member',
      avatar_url: null
    };
  };

  const isLocalOnly = isRotationLocalOnly();

  // Calculations for Expense metrics
  const getExpenseMetrics = (expense: Expense) => {
    const totalMembers = members?.length || 1;
    const shareAmount = expense.amount / totalMembers;
    const payments = paymentLogs?.filter(p => p.expense_id === expense.id) || [];
    const paidMemberIds = payments.map(p => p.user_id);
    const hasPaid = paidMemberIds.includes(user?.id || '');
    const paidCount = payments.length;
    
    return {
      shareAmount,
      paidMemberIds,
      hasPaid,
      paidCount,
      totalCount: totalMembers,
      progressPercent: (paidCount / totalMembers) * 100
    };
  };

  if (isGroupsLoading) {
    return (
      <div className="h-full flex items-center justify-center min-h-[500px]">
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 pb-20">
      {/* Top Banner Warning for Local Only */}
      {isLocalOnly && selectedGroupId && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex gap-3 text-amber-400 text-xs md:text-sm items-start shadow-lg">
          <AlertTriangle className="shrink-0 w-5 h-5 mt-0.5" />
          <div>
            <span className="font-bold">Offline Mode (LocalStorage):</span> Payments tables are not configured in Supabase. Expenses and logs are stored locally. Apply the migration in <a href="file:///Users/nguyenminhkhang/Documents/react/group-scheduler/docs/database/migration.sql" className="underline font-bold">migration.sql</a> to enable cloud sync.
          </div>
        </div>
      )}

      {/* Header & Group Selector */}
      <div className="mt-6 md:mt-2 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <CreditCard size={36} className="text-primary animate-pulse" />
            Payment Tracker
          </h2>
          <p className="text-gray-400 text-sm md:text-lg">Track group bills, split expenses, and verify member payments manually.</p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {groups && groups.length > 0 ? (
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl p-1.5 pr-3 shadow-inner">
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="bg-transparent text-white px-3 py-2 text-sm md:text-base font-bold focus:outline-none cursor-pointer max-w-[180px] md:max-w-[240px]"
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id} className="bg-neutral-900 text-white">
                    {g.name}
                  </option>
                ))}
              </select>
              <Users size={16} className="text-gray-400 shrink-0" />
            </div>
          ) : null}

          <button
            onClick={() => setIsJoinGroupModalOpen(true)}
            className="p-3 bg-white/5 border border-white/10 text-emerald-400 hover:text-emerald-300 hover:bg-white/10 transition-colors rounded-2xl text-sm font-bold flex items-center gap-2 shadow-lg"
          >
            Join Group
          </button>
          <button
            onClick={() => setIsCreateGroupModalOpen(true)}
            className="p-3 bg-primary hover:bg-blue-600 transition-colors text-white rounded-2xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <Plus size={16} /> New Group
          </button>
        </div>
      </div>

      {!selectedGroupId ? (
        // No group selected/created state
        <div className="glass p-10 md:p-20 rounded-[32px] text-center border border-white/5 shadow-2xl mt-10 max-w-2xl mx-auto">
          <div className="w-20 h-20 rounded-full bg-white/5 mx-auto flex items-center justify-center mb-6 border border-white/10">
            <DollarSign size={36} className="text-gray-500" />
          </div>
          <h3 className="text-2xl font-bold mb-4">No Groups Found</h3>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">Create a group or join one to begin adding shared bills and split expenses.</p>
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => setIsJoinGroupModalOpen(true)} 
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold px-6 py-3.5 rounded-2xl transition-all"
            >
              Join Group
            </button>
            <button 
              onClick={() => setIsCreateGroupModalOpen(true)} 
              className="bg-primary hover:bg-blue-600 text-white font-bold px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-primary/20"
            >
              Create Group
            </button>
          </div>
        </div>
      ) : (
        // Group Payments Dashboard
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Expenses Board (Left Column - 7cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Group details card */}
            {selectedGroup && (
              <div className="glass p-5 rounded-[24px] border border-white/5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold">
                    {selectedGroup.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-lg text-white leading-tight">{selectedGroup.name}</h4>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{members?.length || 0} members active</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-gray-300">
                    CODE: <span className="text-white font-bold">{selectedGroup.invite_code.toUpperCase()}</span>
                  </span>
                  <button 
                    onClick={copyInviteCode}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-gray-300 active:scale-95"
                    title="Copy invite code"
                  >
                    <Copy size={16} />
                  </button>
                  {isLocalOnly && (
                    <button
                      onClick={() => setIsMockMemberModalOpen(true)}
                      className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 transition-colors active:scale-95 text-xs font-bold flex items-center gap-1.5"
                      title="Add mock user for local testing"
                    >
                      <UserPlus size={15} /> Add Member
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Expenses List Card */}
            <div className="glass rounded-[28px] p-6 md:p-8 border border-white/5 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary/10 blur-[60px] rounded-full"></div>
              
              <div className="flex items-center justify-between mb-6 relative z-10">
                <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText size={22} className="text-gray-400" />
                  Active Expenses
                </h3>
                <button
                  onClick={() => setIsCreateExpenseModalOpen(true)}
                  className="px-4 py-2.5 bg-primary hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <Plus size={14} /> Add Expense
                </button>
              </div>

              {isExpensesLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-3 border-primary border-t-transparent animate-spin"></div>
                </div>
              ) : !expenses || expenses.length === 0 ? (
                <div className="text-center py-20 bg-black/10 rounded-2xl border border-white/5">
                  <p className="text-gray-400 font-medium">No expenses created yet for this group.</p>
                  <p className="text-xs text-gray-500 mt-1">Tap Add Expense above to split your first bill!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {expenses.map((expense) => {
                    const { shareAmount, hasPaid, paidCount, totalCount, progressPercent, paidMemberIds } = getExpenseMetrics(expense);
                    const creator = getProfileForLog(expense.created_by);
                    const isCreator = expense.created_by === user?.id;

                    return (
                      <div key={expense.id} className="bg-black/30 border border-white/5 rounded-2xl p-5 hover:bg-black/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1 space-y-2.5">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-extrabold text-white text-lg">{expense.title}</h4>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Added by {creator.full_name || 'Member'} on {format(parseISO(expense.created_at), 'MMM d, yyyy')}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-xl font-black text-primary block">${expense.amount.toFixed(2)}</span>
                              <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-gray-400 font-semibold inline-block mt-0.5">
                                ${shareAmount.toFixed(2)} each
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-gray-400">
                              <span>Payment Progress</span>
                              <span>{paidCount} of {totalCount} paid</span>
                            </div>
                            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                              <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500" 
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>

                          {/* List of payers avatars */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mr-1">Paid by:</span>
                            {paidCount === 0 ? (
                              <span className="text-xs text-gray-500 italic">No one yet</span>
                            ) : (
                              members?.map(m => {
                                const didPay = paidMemberIds.includes(m.user_id);
                                if (!didPay) return null;
                                return (
                                  <div 
                                    key={m.user_id} 
                                    className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center text-[10px] font-black text-white uppercase border border-emerald-500/50 shadow-sm"
                                    title={m.profiles.full_name || 'Member'}
                                  >
                                    {m.profiles.avatar_url ? (
                                      <img src={m.profiles.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                                    ) : (
                                      m.profiles.full_name?.charAt(0) || '?'
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Actions block */}
                        <div className="flex md:flex-col gap-2 shrink-0 md:w-36 justify-end items-end">
                          {hasPaid ? (
                            <button
                              onClick={() => unmarkPaidMutation.mutate(expense.id)}
                              className="flex-1 md:w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition-all active:scale-[0.98]"
                              title="Click to undo your payment confirmation"
                            >
                              <CheckCircle2 size={14} /> Paid ✓
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenPayModal(expense.id)}
                              className="flex-1 md:w-full py-2 bg-primary hover:bg-blue-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1 transition-all active:scale-[0.98] shadow-md shadow-primary/10"
                            >
                              Mark as Paid
                            </button>
                          )}

                          {isCreator && (
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this expense and all its payments?')) {
                                  deleteExpenseMutation.mutate(expense.id);
                                }
                              }}
                              className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-xl transition-all active:scale-[0.95]"
                              title="Delete Expense"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: Members & Payments History (Right column - 5cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Members List Card */}
            <div className="glass p-6 rounded-[28px] border border-white/5 shadow-xl flex flex-col max-h-[300px]">
              <h3 className="font-bold text-lg text-white mb-4 flex items-center justify-between">
                Group Members
                <span className="text-xs bg-white/10 px-2.5 py-1 rounded-full font-bold">{members?.length || 0}</span>
              </h3>

              {isMembersLoading ? (
                <div className="py-10 flex justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                </div>
              ) : !members || members.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No members in this group.</p>
              ) : (
                <div className="space-y-3 overflow-y-auto hide-scrollbar flex-1 pr-1">
                  {members.map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5 hover:bg-black/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-bold text-white uppercase overflow-hidden border border-white/5">
                          {member.profiles.avatar_url ? (
                            <img src={member.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            member.profiles.full_name?.charAt(0) || '?'
                          )}
                        </div>
                        <span className="text-sm font-semibold text-gray-200">{member.profiles.full_name || 'Unknown User'}</span>
                      </div>
                      <span className="text-[10px] font-bold bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-gray-400 capitalize">
                        {member.role || 'member'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* History Feed Card */}
            <div className="glass p-6 rounded-[28px] border border-white/5 shadow-xl flex flex-col max-h-[400px]">
              <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                <History size={18} className="text-gray-400" />
                Recent Payments Log
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full ml-auto font-bold">{paymentLogs?.length || 0}</span>
              </h3>

              {isPaymentLogsLoading ? (
                <div className="py-10 flex justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                </div>
              ) : !paymentLogs || paymentLogs.length === 0 ? (
                <div className="text-center py-10 flex-1 flex flex-col justify-center">
                  <p className="text-gray-500 text-sm">No payment confirmations recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto hide-scrollbar flex-1 pr-1">
                  {paymentLogs.map(log => {
                    const profile = getProfileForLog(log.user_id);
                    const associatedExpense = expenses?.find(e => e.id === log.expense_id);

                    return (
                      <div key={log.id} className="flex gap-3 bg-black/20 p-3 rounded-xl border border-white/5 hover:bg-black/30 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-bold text-white uppercase overflow-hidden border border-white/5 shrink-0">
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            profile.full_name?.charAt(0) || '?'
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-200">
                            <span className="text-white font-bold">{profile.full_name || 'Someone'}</span> confirmed payment for <span className="text-primary font-bold">"{associatedExpense?.title || 'Expense'}"</span>
                          </p>
                          {log.note && (
                            <p className="text-xs text-gray-400 mt-1 bg-white/5 px-2 py-1.5 rounded-lg border border-white/5 italic">
                              "{log.note}"
                            </p>
                          )}
                          <p className="text-[10px] text-gray-500 mt-1.5 font-medium">
                            {format(parseISO(log.paid_at), 'MMM d, yyyy • h:mm a')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODALS */}

      {/* Create Group Modal */}
      {isCreateGroupModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-neutral-900 border border-white/10 rounded-[28px] w-full max-w-md overflow-hidden shadow-2xl relative">
            <button 
              onClick={() => setIsCreateGroupModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
            <form onSubmit={(e) => { e.preventDefault(); createGroupMutation.mutate(newGroupName); }} className="p-6 md:p-8 space-y-6">
              <h3 className="text-xl font-bold text-white">Create Payment Group</h3>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Group Name</label>
                <input 
                  type="text" 
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Roommates Flat 4B" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={createGroupMutation.isPending}
                className="w-full py-3.5 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-primary/20"
              >
                {createGroupMutation.isPending ? 'Creating...' : 'Create Group'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {isJoinGroupModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-neutral-900 border border-white/10 rounded-[28px] w-full max-w-md overflow-hidden shadow-2xl relative">
            <button 
              onClick={() => setIsJoinGroupModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
            <form onSubmit={(e) => { e.preventDefault(); joinGroupMutation.mutate(joinInviteCode); }} className="p-6 md:p-8 space-y-6">
              <h3 className="text-xl font-bold text-white">Join Payment Group</h3>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Invite Code</label>
                <input 
                  type="text" 
                  value={joinInviteCode}
                  onChange={(e) => setJoinInviteCode(e.target.value)}
                  placeholder="6-character code (e.g. ax42d8)" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors font-mono uppercase"
                  maxLength={10}
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={joinGroupMutation.isPending}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20"
              >
                {joinGroupMutation.isPending ? 'Joining...' : 'Join Group'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {isCreateExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-neutral-900 border border-white/10 rounded-[28px] w-full max-w-md overflow-hidden shadow-2xl relative">
            <button 
              onClick={() => setIsCreateExpenseModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
            <form onSubmit={handleExpenseSubmit} className="p-6 md:p-8 space-y-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <DollarSign size={20} className="text-primary" />
                Add Shared Expense
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Expense Title</label>
                  <input 
                    type="text" 
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    placeholder="e.g. Netflix Subscription, Internet, Electricity" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Amount ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.01"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="e.g. 15.00" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors font-bold"
                    required
                  />
                </div>

                {members && members.length > 0 && (
                  <p className="text-xs text-gray-500 bg-white/5 p-3 rounded-lg border border-white/5">
                    Will be split equally among all <span className="text-white font-bold">{members.length}</span> members. 
                    {expenseAmount && !isNaN(parseFloat(expenseAmount)) && (
                      <span> Each member owes: <span className="text-primary font-bold">${(parseFloat(expenseAmount) / members.length).toFixed(2)}</span></span>
                    )}
                  </p>
                )}
              </div>

              <button 
                type="submit" 
                disabled={addExpenseMutation.isPending}
                className="w-full py-3.5 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-primary/20"
              >
                {addExpenseMutation.isPending ? 'Adding...' : 'Add Expense'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Pay Confirmation Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-neutral-900 border border-white/10 rounded-[28px] w-full max-w-md overflow-hidden shadow-2xl relative">
            <button 
              onClick={() => setIsPayModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
            <form onSubmit={handlePaySubmit} className="p-6 md:p-8 space-y-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={20} className="text-emerald-400" />
                Confirm Payment
              </h3>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payment Notes (Optional)</label>
                <textarea 
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g. Sent via Venmo, paid my portion in cash" 
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={markPaidMutation.isPending}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20"
              >
                {markPaidMutation.isPending ? 'Confirming...' : 'I have Paid'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Local Mock Member Modal */}
      {isMockMemberModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-neutral-900 border border-white/10 rounded-[28px] w-full max-w-md overflow-hidden shadow-2xl relative">
            <button 
              onClick={() => setIsMockMemberModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
            <form onSubmit={(e) => { e.preventDefault(); addMockMemberMutation.mutate(mockMemberName); }} className="p-6 md:p-8 space-y-6">
              <h3 className="text-xl font-bold text-white">Add Mock Member (Local Only)</h3>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Member Full Name</label>
                <input 
                  type="text" 
                  value={mockMemberName}
                  onChange={(e) => setMockMemberName(e.target.value)}
                  placeholder="e.g. Sarah Connor" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={addMockMemberMutation.isPending}
                className="w-full py-3.5 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-primary/20"
              >
                Add Mock Member
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
