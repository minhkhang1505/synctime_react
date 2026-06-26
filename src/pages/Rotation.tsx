import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { useUIStore } from '../store/useUIStore';
import { fetchUserGroups, fetchGroupMembers } from '../features/groups/api/groups-api';
import { 
  fetchRotationLogs, 
  saveRotationLog, 
  deleteRotationLog, 
  isRotationLocalOnly,
  subscribeToRotationLogs
} from '../features/groups/api/rotation-api';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  getDay, 
  isSameDay, 
  isToday, 
  parseISO 
} from 'date-fns';
import { 
  RotateCw, 
  Users, 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Copy, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  ClipboardList, 
  AlertTriangle,
  History
} from 'lucide-react';
import toast from 'react-hot-toast';

export function Rotation() {
  const { user } = useAuthStore();
  const { setCreateGroupOpen, setJoinGroupOpen } = useUIStore();
  const queryClient = useQueryClient();

  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isDayDetailsOpen, setIsDayDetailsOpen] = useState(false);
  
  // Log Turn Form State
  const [logFormUserId, setLogFormUserId] = useState<string>('');
  const [logFormNotes, setLogFormNotes] = useState<string>('');
  const [logFormDate, setLogFormDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // 1. Fetch user's groups
  const { data: groups, isLoading: isGroupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: fetchUserGroups,
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
    queryKey: ['group_members', selectedGroupId],
    queryFn: () => fetchGroupMembers(selectedGroupId),
    enabled: !!selectedGroupId
  });

  // 3. Fetch rotation logs
  const { data: logs, isLoading: isLogsLoading } = useQuery({
    queryKey: ['rotation_logs', selectedGroupId],
    queryFn: () => fetchRotationLogs(selectedGroupId),
    enabled: !!selectedGroupId
  });

  // Real-time subscription to rotation logs
  useEffect(() => {
    if (!selectedGroupId || isRotationLocalOnly()) return;

    const subscription = subscribeToRotationLogs(selectedGroupId, () => {
      queryClient.invalidateQueries({ queryKey: ['rotation_logs', selectedGroupId] });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedGroupId, queryClient]);

  // Mutations
  const addLogMutation = useMutation({
    mutationFn: ({ date, notes, targetUserId }: { date: string; notes: string; targetUserId?: string }) => 
      saveRotationLog(selectedGroupId, date, notes, targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotation_logs', selectedGroupId] });
      toast.success('Turn logged successfully!');
      setIsLogModalOpen(false);
      setLogFormNotes('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to log turn');
    }
  });

  const deleteLogMutation = useMutation({
    mutationFn: (logId: string) => deleteRotationLog(logId, selectedGroupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotation_logs', selectedGroupId] });
      toast.success('Log entry deleted');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete log entry');
    }
  });

  // Helper to map profiles when locally fallbacking or missing profiles
  const getProfileForLog = (log: any) => {
    if (log.profiles) return log.profiles;
    // Map from members list
    const member = members?.find(m => m.user_id === log.user_id);
    if (member) return member.profiles;
    return {
      id: log.user_id,
      full_name: log.user_id === user?.id ? 'You' : 'Unknown Member',
      avatar_url: null
    };
  };

  // Stats calculation
  const getStats = () => {
    if (!members || !logs) return [];
    
    // Count turns
    const counts: Record<string, number> = {};
    const lastActive: Record<string, string> = {};
    
    members.forEach(m => {
      counts[m.user_id] = 0;
      lastActive[m.user_id] = '';
    });

    logs.forEach(log => {
      if (counts[log.user_id] !== undefined) {
        counts[log.user_id]++;
      }
      if (!lastActive[log.user_id] || new Date(log.tracked_at) > new Date(lastActive[log.user_id])) {
        lastActive[log.user_id] = log.tracked_at;
      }
    });

    return members.map(m => {
      return {
        member: m,
        count: counts[m.user_id] || 0,
        lastActive: lastActive[m.user_id] || null
      };
    }).sort((a, b) => {
      // Sort by turn count ascending (who has done the least work), then by last active (longest ago)
      if (a.count !== b.count) return a.count - b.count;
      if (!a.lastActive) return -1;
      if (!b.lastActive) return 1;
      return new Date(a.lastActive).getTime() - new Date(b.lastActive).getTime();
    });
  };

  const stats = getStats();
  const nextUp = stats.length > 0 ? stats[0] : null;

  // Get logs for the current selected month
  const getLogsForSelectedMonth = () => {
    if (!logs) return [];
    return logs.filter(log => {
      try {
        const logDate = parseISO(log.tracked_date);
        return logDate.getMonth() === currentMonth.getMonth() && 
               logDate.getFullYear() === currentMonth.getFullYear();
      } catch (e) {
        return false;
      }
    }).sort((a, b) => b.tracked_date.localeCompare(a.tracked_date) || new Date(b.tracked_at).getTime() - new Date(a.tracked_at).getTime()); // Sort newest day first
  };

  const monthlyLogs = getLogsForSelectedMonth();

  // Calendar calculations
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Calculate padding days for start of month
  // date-fns getDay: 0 is Sunday, 1 is Monday...
  // We want Mon = 0, Tue = 1 ... Sun = 6
  const startDayOfWeekIndex = (getDay(monthStart) + 6) % 7; 
  const calendarPadding = Array(startDayOfWeekIndex).fill(null);

  const getLogsForDate = (date: Date) => {
    if (!logs) return [];
    const dateStr = format(date, 'yyyy-MM-dd');
    return logs.filter(log => log.tracked_date === dateStr);
  };

  const copyInviteCode = () => {
    if (!selectedGroup) return;
    navigator.clipboard.writeText(selectedGroup.invite_code);
    toast.success('Invite code copied!');
  };

  const handleOpenLogModal = (date?: Date) => {
    if (date) {
      setLogFormDate(format(date, 'yyyy-MM-dd'));
    } else {
      setLogFormDate(format(new Date(), 'yyyy-MM-dd'));
    }
    setLogFormUserId(user?.id || '');
    setIsLogModalOpen(true);
  };

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) return;
    addLogMutation.mutate({
      date: logFormDate,
      notes: logFormNotes,
      targetUserId: logFormUserId || undefined
    });
  };

  const isLocalOnly = isRotationLocalOnly();

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
            <span className="font-bold">Offline Mode:</span> The <code className="bg-black/30 px-1.5 py-0.5 rounded">rotation_logs</code> table is not configured in Supabase. Turns are stored in LocalStorage. Check <a href="file:///Users/nguyenminhkhang/Documents/react/group-scheduler/docs/database/rotation_logs.sql" className="underline font-bold">rotation_logs.sql</a> to enable group syncing.
          </div>
        </div>
      )}

      {/* Header & Group Selector */}
      <div className="mt-6 md:mt-2 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <RotateCw size={36} className="text-primary animate-spin-slow" />
            Rotation Tracker
          </h2>
          <p className="text-gray-400 text-sm md:text-lg">Track chores, duties, or schedules rotating among members.</p>
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
            onClick={() => setJoinGroupOpen(true)}
            className="p-3 bg-white/5 border border-white/10 text-emerald-400 hover:text-emerald-300 hover:bg-white/10 transition-colors rounded-2xl text-sm font-bold flex items-center gap-2 shadow-lg"
          >
            Join Group
          </button>
          <button
            onClick={() => setCreateGroupOpen(true)}
            className="p-3 bg-primary hover:bg-blue-600 transition-colors text-white rounded-2xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <Plus size={16} /> Create Group
          </button>
        </div>
      </div>

      {!selectedGroupId ? (
        // No group selected/created state
        <div className="glass p-10 md:p-20 rounded-[32px] text-center border border-white/5 shadow-2xl mt-10 max-w-2xl mx-auto">
          <div className="w-20 h-20 rounded-full bg-white/5 mx-auto flex items-center justify-center mb-6 border border-white/10">
            <ClipboardList size={36} className="text-gray-500" />
          </div>
          <h3 className="text-2xl font-bold mb-4">No Groups Found</h3>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">Create a group or join one using an invite code to start tracking member rotations.</p>
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => setJoinGroupOpen(true)} 
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold px-6 py-3.5 rounded-2xl transition-all"
            >
              Join Group
            </button>
            <button 
              onClick={() => setCreateGroupOpen(true)} 
              className="bg-primary hover:bg-blue-600 text-white font-bold px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-primary/20"
            >
              Create Group
            </button>
          </div>
        </div>
      ) : (
        // Group Dashboard
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Calendar view (Left column - 7cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Group details card */}
            {selectedGroup && (
              <div className="glass p-5 rounded-[24px] border border-white/5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold">
                    {selectedGroup.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-white leading-tight">{selectedGroup.name}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">{members?.length || 0} rotation members</p>
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
                </div>
              </div>
            )}

            {/* Monthly Calendar Card */}
            <div className="glass rounded-[28px] p-5 md:p-8 border border-white/5 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary/10 blur-[60px] rounded-full"></div>
              
              {/* Calendar month controls */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider">
                  {format(currentMonth, 'MMMM yyyy')}
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button 
                    onClick={() => setCurrentMonth(new Date())}
                    className="px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 text-xs font-bold transition-colors"
                  >
                    Today
                  </button>
                  <button 
                    onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2 text-center mb-2">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                  <span key={idx} className="text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest py-2">
                    {day}
                  </span>
                ))}
              </div>

              {isLogsLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-3 border-primary border-t-transparent animate-spin"></div>
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2.5">
                  {/* Padding items */}
                  {calendarPadding.map((_, idx) => (
                    <div key={`pad-${idx}`} className="aspect-square opacity-0 pointer-events-none"></div>
                  ))}

                  {/* Day items */}
                  {monthDays.map((day, idx) => {
                    const dayLogs = getLogsForDate(day);
                    const isDaySelected = isSameDay(day, selectedDate);
                    const isDayToday = isToday(day);
                    const hasLogs = dayLogs.length > 0;

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedDate(day);
                          if (hasLogs) {
                            setIsDayDetailsOpen(true);
                          } else {
                            handleOpenLogModal(day);
                          }
                        }}
                        className={`
                          aspect-square rounded-2xl border transition-all flex flex-col justify-between p-2 relative group overflow-hidden
                          ${isDaySelected 
                            ? 'bg-primary border-primary text-white shadow-lg shadow-primary/25 scale-[1.03]' 
                            : isDayToday
                              ? 'bg-white/10 border-white/20 text-white font-bold'
                              : 'bg-black/25 border-white/5 text-gray-300 hover:bg-white/5 hover:border-white/10'
                          }
                          ${hasLogs && !isDaySelected ? 'border-primary/45 shadow-[0_0_12px_rgba(59,130,246,0.15)] bg-primary/10' : ''}
                        `}
                      >
                        <span className={`text-[11px] md:text-sm font-bold ${isDaySelected ? 'text-white' : ''}`}>
                          {format(day, 'd')}
                        </span>

                        {hasLogs && (
                          <div className="flex -space-x-1.5 self-end mt-auto max-w-full">
                            {dayLogs.slice(0, 3).map((log) => {
                              const profile = getProfileForLog(log);
                              return (
                                <div 
                                  key={log.id} 
                                  className={`w-4 h-4 md:w-5 md:h-5 rounded-full border border-neutral-900 overflow-hidden shrink-0 flex items-center justify-center bg-gray-600 text-[8px] font-bold text-white uppercase`}
                                  title={`${profile.full_name || 'Member'}`}
                                >
                                  {profile.avatar_url ? (
                                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    profile.full_name?.charAt(0) || '?'
                                  )}
                                </div>
                              );
                            })}
                            {dayLogs.length > 3 && (
                              <div className="w-4 h-4 md:w-5 md:h-5 rounded-full border border-neutral-900 bg-neutral-800 text-[8px] font-black text-gray-300 flex items-center justify-center shrink-0">
                                +{dayLogs.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Glow dot overlay on hover */}
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex gap-4">
              <button 
                onClick={() => handleOpenLogModal(new Date())}
                className="flex-1 p-4 rounded-2xl bg-primary hover:bg-blue-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
              >
                <Plus size={18} /> Log Turn Today
              </button>
              <button 
                onClick={() => {
                  setSelectedDate(new Date());
                  handleOpenLogModal(new Date());
                }}
                className="flex-1 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <CalendarIcon size={18} className="text-gray-400" /> Log Custom Date
              </button>
            </div>

          </div>

          {/* Sidebar: Stats & Feed (Right column - 5cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Next Up Rotation Card */}
            {nextUp && (
              <div className="glass p-6 rounded-[28px] border border-primary/20 relative overflow-hidden bg-gradient-to-tr from-primary/10 to-transparent shadow-xl">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 blur-[50px] rounded-full"></div>
                <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                  <User size={16} /> Next in Rotation
                </h3>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-white font-black text-xl border border-white/10 shadow-lg overflow-hidden shrink-0">
                    {nextUp.member.profiles.avatar_url ? (
                      <img src={nextUp.member.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      nextUp.member.profiles.full_name?.charAt(0) || '?'
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-lg text-white">{nextUp.member.profiles.full_name || 'Member'}</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      {nextUp.count === 0 
                        ? 'Has not logged any turns yet.' 
                        : `Logged ${nextUp.count} turns. Last active: ${nextUp.lastActive ? format(parseISO(nextUp.lastActive), 'MMM d, yyyy') : 'never'}`
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Member turn leaderboard stats */}
            <div className="glass p-6 rounded-[28px] border border-white/5 shadow-xl flex flex-col max-h-[300px]">
              <h3 className="font-bold text-lg text-white mb-4 flex items-center justify-between">
                Rotation Members
                <span className="text-xs bg-white/10 px-2.5 py-1 rounded-full font-bold">{members?.length || 0}</span>
              </h3>

              {isMembersLoading ? (
                <div className="py-10 flex justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                </div>
              ) : stats.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No members in this group.</p>
              ) : (
                <div className="space-y-3 overflow-y-auto hide-scrollbar flex-1 pr-1">
                  {stats.map(({ member, count }) => (
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
                      <span className="text-xs font-bold bg-white/5 border border-white/10 px-3 py-1 rounded-lg text-primary">
                        {count} turns
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* History Feed Card */}
            <div className="glass p-6 rounded-[28px] border border-white/5 shadow-xl flex flex-col max-h-[400px]">
              <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                <History size={18} className="text-gray-400 animate-pulse" />
                Logs in {format(currentMonth, 'MMMM yyyy')}
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full ml-auto font-bold">{monthlyLogs.length}</span>
              </h3>

              {isLogsLoading ? (
                <div className="py-10 flex justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                </div>
              ) : !monthlyLogs || monthlyLogs.length === 0 ? (
                <div className="text-center py-10 flex-1 flex flex-col justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3 border border-white/10">
                    <ClipboardList size={20} className="text-gray-500" />
                  </div>
                  <p className="text-gray-400 text-sm">No logs recorded this month.</p>
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto hide-scrollbar flex-1 pr-1">
                  {monthlyLogs.map(log => {
                    const profile = getProfileForLog(log);
                    const isOwnLog = log.user_id === user?.id;

                    return (
                      <div key={log.id} className="relative pl-5 border-l border-white/10 pb-1 group/item">
                        {/* Timeline Bullet */}
                        <div className="absolute left-[-4.5px] top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-background"></div>
                        
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="font-extrabold text-sm text-white">{profile.full_name || 'Member'}</span>
                            <span className="text-[11px] text-gray-500 ml-2 font-medium">
                              {format(new Date(log.tracked_at), 'MMM d, h:mm a')}
                            </span>
                            <p className="text-xs text-primary font-bold mt-0.5">
                              Tracked for: {format(parseISO(log.tracked_date), 'MMMM d, yyyy')}
                            </p>
                            {log.notes && (
                              <p className="text-xs bg-black/30 border border-white/5 rounded-lg p-2 mt-1.5 text-gray-400 italic">
                                {log.notes}
                              </p>
                            )}
                          </div>

                          {isOwnLog && (
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this log entry?')) {
                                  deleteLogMutation.mutate(log.id);
                                }
                              }}
                              className="text-gray-500 hover:text-red-400 p-1 rounded-lg hover:bg-white/5 opacity-0 group-hover/item:opacity-100 transition-opacity"
                              title="Delete log"
                            >
                              <Trash2 size={13} />
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

        </div>
      )}

      {/* 1. Log Turn Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md glass rounded-[32px] p-6 border border-white/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-bold mb-5 flex items-center gap-2">
              <ClipboardList size={22} className="text-primary" />
              Log Rotation Turn
            </h3>
            
            <form onSubmit={handleLogSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest px-1">Selected Member</label>
                <select
                  value={logFormUserId}
                  onChange={(e) => setLogFormUserId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer"
                  required
                >
                  <option value="" disabled className="bg-neutral-900">Select group member</option>
                  {members?.map(m => (
                    <option key={m.user_id} value={m.user_id} className="bg-neutral-900">
                      {m.profiles.full_name} {m.user_id === user?.id ? '(You)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest px-1">Date of Track</label>
                <input 
                  type="date"
                  value={logFormDate}
                  onChange={(e) => setLogFormDate(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest px-1">Notes / Description</label>
                <textarea 
                  value={logFormNotes}
                  onChange={(e) => setLogFormNotes(e.target.value)}
                  placeholder="e.g. Swept the floor, clean kitchen, checked backups..."
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all min-h-[90px] text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="flex-1 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLogMutation.isPending || !logFormUserId}
                  className="flex-1 py-3.5 bg-primary hover:bg-blue-600 disabled:opacity-50 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {addLogMutation.isPending ? <RotateCw className="animate-spin w-4 h-4" /> : null}
                  Log Turn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Calendar Day Detail Modal */}
      {isDayDetailsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md glass rounded-[32px] p-6 border border-white/10 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="mb-4">
              <span className="text-xs font-black text-primary uppercase tracking-widest">Rotation logs for</span>
              <h3 className="text-2xl font-black text-white mt-1">
                {format(selectedDate, 'MMMM d, yyyy')}
              </h3>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 hide-scrollbar pr-1 py-2 max-h-[350px]">
              {getLogsForDate(selectedDate).map(log => {
                const profile = getProfileForLog(log);
                const isOwnLog = log.user_id === user?.id;

                return (
                  <div key={log.id} className="bg-black/30 border border-white/5 p-4 rounded-2xl relative group/dayitem">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-bold text-white uppercase overflow-hidden border border-white/10">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          profile.full_name?.charAt(0) || '?'
                        )}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-gray-200 leading-tight">{profile.full_name || 'Member'}</h4>
                        <p className="text-[10px] text-gray-500 mt-0.5">Logged {format(new Date(log.tracked_at), 'MMM d, h:mm a')}</p>
                      </div>
                    </div>
                    {log.notes && (
                      <p className="text-xs text-gray-400 bg-neutral-900/30 p-2.5 rounded-xl border border-white/5 italic">
                        {log.notes}
                      </p>
                    )}

                    {isOwnLog && (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this log entry?')) {
                            deleteLogMutation.mutate(log.id);
                            // If it was the last log on this date, close details modal
                            if (getLogsForDate(selectedDate).length <= 1) {
                              setIsDayDetailsOpen(false);
                            }
                          }
                        }}
                        className="absolute top-4 right-4 text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 opacity-0 group-hover/dayitem:opacity-100 transition-all"
                        title="Delete log"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setIsDayDetailsOpen(false);
                  handleOpenLogModal(selectedDate);
                }}
                className="flex-1 py-3.5 bg-primary hover:bg-blue-600 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20"
              >
                <Plus size={16} /> Log Another Turn
              </button>
              <button
                type="button"
                onClick={() => setIsDayDetailsOpen(false)}
                className="flex-1 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-2xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
