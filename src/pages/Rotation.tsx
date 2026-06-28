import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { 
  fetchUserRotationGroups, 
  fetchRotationGroupMembers, 
  addRotationMockMember,
  fetchExpenses,
  createExpense,
  deleteExpense,
  subscribeToPayments,
  isRotationLocalOnly,
  Expense
} from '../features/groups/api/rotation-api';
import { format, parseISO } from 'date-fns';
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  AlertTriangle,
  History,
  UserPlus,
  X,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';

export function Rotation() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id: selectedGroupId } = useParams<{ id: string }>();

  // Modal states
  const [isMockMemberModalOpen, setIsMockMemberModalOpen] = useState(false);
  const [mockMemberName, setMockMemberName] = useState('');

  // Month view states
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();
  const [visibleMonths, setVisibleMonths] = useState<Array<{ year: number; month: number; isCollapsed: boolean }>>([
    { year: currentYear, month: currentMonthIdx, isCollapsed: false }
  ]);

  // Tracking popup states
  const [selectedDateForTracking, setSelectedDateForTracking] = useState<Date | null>(null);
  const [trackingType, setTrackingType] = useState<'nước' | 'xe'>('nước');
  const [trackingAmount, setTrackingAmount] = useState<string>('');

  // 1. Fetch user's groups
  const { data: groups, isLoading: isGroupsLoading } = useQuery({
    queryKey: ['payments_groups'],
    queryFn: fetchUserRotationGroups,
    enabled: !!user
  });

  const selectedGroup = groups?.find(g => g.id === selectedGroupId);

  // 2. Fetch members of the selected group
  const { data: members, isLoading: isMembersLoading } = useQuery({
    queryKey: ['payments_members', selectedGroupId],
    queryFn: () => fetchRotationGroupMembers(selectedGroupId!),
    enabled: !!selectedGroupId
  });

  // 3. Fetch expenses
  const { data: expenses, isLoading: isExpensesLoading } = useQuery({
    queryKey: ['payments_expenses', selectedGroupId],
    queryFn: () => fetchExpenses(selectedGroupId!),
    enabled: !!selectedGroupId
  });

  // Real-time subscription to payments and expenses
  useEffect(() => {
    if (!selectedGroupId || isRotationLocalOnly()) return;

    const subscription = subscribeToPayments(selectedGroupId!, () => {
      queryClient.invalidateQueries({ queryKey: ['payments_expenses', selectedGroupId] });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedGroupId, queryClient]);

  // Mutations
  const addMockMemberMutation = useMutation({
    mutationFn: (name: string) => addRotationMockMember(selectedGroupId!, name),
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
      createExpense(selectedGroupId!, title, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments_expenses', selectedGroupId] });
      toast.success('Ghi nhận chi phí thành công!');
      setSelectedDateForTracking(null);
      setTrackingAmount('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Lỗi khi ghi nhận chi phí');
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId: string) => deleteExpense(expenseId, selectedGroupId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments_expenses', selectedGroupId] });
      toast.success('Đã xóa chi phí');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Không thể xóa chi phí');
    }
  });

  // Helpers
  const handleAddNewMonth = () => {
    setVisibleMonths(prev => {
      const last = prev[prev.length - 1];
      let nextYear = last.year;
      let nextMonth = last.month + 1;
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear += 1;
      }
      const collapsedPrev = prev.map(m => ({ ...m, isCollapsed: true }));
      return [...collapsedPrev, { year: nextYear, month: nextMonth, isCollapsed: false }];
    });
  };

  const toggleMonthCollapse = (index: number) => {
    setVisibleMonths(prev => prev.map((m, i) => i === index ? { ...m, isCollapsed: !m.isCollapsed } : m));
  };

  const getMonthLabel = (year: number, month: number) => {
    const monthNames = [
      'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
      'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];
    return `${monthNames[month]} / ${year}`;
  };

  const getMonthDaysGrid = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    let dayOfWeek = firstDay.getDay(); 
    if (dayOfWeek === 0) dayOfWeek = 7; // Sunday is index 7
    const startPadding = dayOfWeek - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const cells = [];
    for (let i = 0; i < startPadding; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(year, month, d));
    }
    return cells;
  };

  const getExpensesForDay = (date: Date) => {
    if (!expenses) return [];
    const dateStr = format(date, 'yyyy-MM-dd');
    return expenses.filter(e => {
      const parts = e.title.split('|');
      return parts.length === 2 && parts[1] === dateStr;
    });
  };

  const parseExpenseTitle = (title: string) => {
    const parts = title.split('|');
    if (parts.length === 2) {
      return {
        type: parts[0] as 'nước' | 'xe',
        date: parts[1]
      };
    }
    return {
      type: 'other' as const,
      date: ''
    };
  };

  const getExpenseDate = (expense: Expense) => {
    const parsed = parseExpenseTitle(expense.title);
    if (parsed.date) {
      return parseISO(parsed.date);
    }
    return parseISO(expense.created_at);
  };

  const sortedExpenses = [...(expenses || [])].sort((a, b) => {
    const dateA = getExpenseDate(a).getTime();
    const dateB = getExpenseDate(b).getTime();
    return dateB - dateA;
  });

  const getProfileForLog = (userId: string) => {
    const member = members?.find(m => m.user_id === userId);
    if (member) return member.profiles;
    return {
      id: userId,
      full_name: userId === user?.id ? 'Bạn' : 'Thành viên',
      avatar_url: null
    };
  };

  const isLocalOnly = isRotationLocalOnly();

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDateForTracking || !trackingAmount) return;

    const amountNum = parseFloat(trackingAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    const dateStr = format(selectedDateForTracking, 'yyyy-MM-dd');
    const title = `${trackingType}|${dateStr}`;

    addExpenseMutation.mutate({
      title,
      amount: amountNum
    });
  };

  const formatInputAmount = (val: string) => {
    if (!val) return '';
    const num = parseFloat(val);
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('vi-VN').format(num);
  };

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatCompactAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}tr`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}k`;
    }
    return `${amount}`;
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

      {/* Header with back button */}
      <div className="flex items-center gap-4 mt-6 md:mt-2 mb-8">
        <button 
          onClick={() => navigate(`/groups/${selectedGroupId}`)} 
          className="p-2.5 md:p-3 rounded-xl md:rounded-2xl glass text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Quay lại chi tiết nhóm"
        >
          <ArrowLeft size={20} className="md:w-7 md:h-7" />
        </button>
        <div>
          <h2 className="text-2xl md:text-5xl font-bold tracking-tight mb-1 flex items-center gap-3">
            <CreditCard size={32} className="text-primary animate-pulse hidden md:inline-block" />
            Payments & Expenses
          </h2>
          <p className="text-gray-400 text-xs md:text-sm">
            Theo dõi và quản lý chi tiêu dùng chung (tiền nước, tiền xe) của nhóm {selectedGroup ? <span className="text-white font-semibold">"{selectedGroup.name}"</span> : ''}.
          </p>
        </div>
      </div>

      {!selectedGroupId ? (
        <div className="glass p-10 md:p-20 rounded-[32px] text-center border border-white/5 shadow-2xl mt-10 max-w-2xl mx-auto">
          <div className="w-20 h-20 rounded-full bg-white/5 mx-auto flex items-center justify-center mb-6 border border-white/10">
            <Calendar size={36} className="text-gray-500" />
          </div>
          <h3 className="text-2xl font-bold mb-4">Chưa chọn nhóm</h3>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">Vui lòng quay lại danh sách nhóm để chọn nhóm và tiếp tục theo dõi.</p>
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => navigate('/groups')} 
              className="bg-primary hover:bg-blue-600 text-white font-bold px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-primary/20"
            >
              Quay lại danh sách nhóm
            </button>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Monthly Calendars (Left Column - 7cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="space-y-6 max-h-[700px] overflow-y-auto pr-2 hide-scrollbar">
              {visibleMonths.map((mConfig, index) => {
                const days = getMonthDaysGrid(mConfig.year, mConfig.month);
                const label = getMonthLabel(mConfig.year, mConfig.month);
                
                return (
                  <div key={`${mConfig.year}-${mConfig.month}`} className="glass rounded-[28px] border border-white/5 shadow-2xl relative overflow-hidden transition-all duration-300">
                    <div className="absolute -top-16 -right-16 w-36 h-36 bg-primary/5 blur-[50px] rounded-full"></div>
                    
                    {/* Month Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/5 relative z-10">
                      <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                        <Calendar size={18} className="text-gray-400" />
                        {label}
                      </h3>
                      
                      <button 
                        onClick={() => toggleMonthCollapse(index)}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-colors flex items-center gap-1.5 text-xs font-bold"
                      >
                        {mConfig.isCollapsed ? (
                          <>Hiện lịch <ChevronDown size={14} /></>
                        ) : (
                          <>Ẩn lịch <ChevronUp size={14} /></>
                        )}
                      </button>
                    </div>

                    {/* Calendar Body */}
                    {!mConfig.isCollapsed && (
                      <div className="p-6 relative z-10">
                        {/* Weekday Headers */}
                        <div className="grid grid-cols-7 gap-2 mb-3 text-center text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider">
                          <span>T2</span>
                          <span>T3</span>
                          <span>T4</span>
                          <span>T5</span>
                          <span>T6</span>
                          <span>T7</span>
                          <span>CN</span>
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-2">
                          {days.map((date, dIdx) => {
                            if (!date) {
                              return <div key={`empty-${dIdx}`} className="aspect-square bg-transparent" />;
                            }

                            const dayNum = date.getDate();
                            const dayExpenses = getExpensesForDay(date);
                            const waterExpenses = dayExpenses.filter(e => parseExpenseTitle(e.title).type === 'nước');
                            const carExpenses = dayExpenses.filter(e => parseExpenseTitle(e.title).type === 'xe');
                            const totalAmount = dayExpenses.reduce((sum, e) => sum + e.amount, 0);

                            return (
                              <button
                                key={date.toISOString()}
                                onClick={() => {
                                  setSelectedDateForTracking(date);
                                  setTrackingType('nước');
                                  setTrackingAmount('');
                                }}
                                className="aspect-square rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 hover:border-white/15 transition-all p-1.5 md:p-2 flex flex-col justify-between items-stretch text-left group/day"
                              >
                                <span className="text-xs md:text-sm font-bold text-gray-400 group-hover/day:text-white transition-colors">
                                  {dayNum}
                                </span>
                                
                                {/* Summary Indicators */}
                                {(waterExpenses.length > 0 || carExpenses.length > 0 || totalAmount > 0) && (
                                  <div className="flex flex-col gap-0.5 mt-1">
                                    <div className="flex items-center gap-0.5">
                                      {waterExpenses.length > 0 && <span className="text-[10px]" title="Có tiền nước">💧</span>}
                                      {carExpenses.length > 0 && <span className="text-[10px]" title="Có tiền xe">🚗</span>}
                                    </div>
                                    {totalAmount > 0 && (
                                      <span className="text-[9px] md:text-[10px] font-black text-emerald-400 leading-none truncate font-mono">
                                        {formatCompactAmount(totalAmount)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add New Month Button */}
            <button
              onClick={handleAddNewMonth}
              className="w-full py-4 glass hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-[20px] text-sm font-bold text-primary flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-lg"
            >
              <Plus size={16} /> Thêm tháng mới
            </button>
          </div>

          {/* Sidebar & Recent List (Right Column - 5cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Members List */}
            <div className="glass p-6 rounded-[28px] border border-white/5 shadow-xl flex flex-col max-h-[260px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-white">
                  Thành viên nhóm
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full font-bold">{members?.length || 0}</span>
                  {isLocalOnly && (
                    <button
                      onClick={() => setIsMockMemberModalOpen(true)}
                      className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 transition-colors text-[10px] font-bold flex items-center gap-1"
                      title="Add mock user for local testing"
                    >
                      <UserPlus size={12} /> +
                    </button>
                  )}
                </div>
              </div>

              {isMembersLoading ? (
                <div className="py-10 flex justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                </div>
              ) : !members || members.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">Chưa có thành viên nào.</p>
              ) : (
                <div className="space-y-2 overflow-y-auto hide-scrollbar flex-1 pr-1">
                  {members.map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between bg-black/20 p-2.5 rounded-xl border border-white/5 hover:bg-black/30 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-bold text-white uppercase overflow-hidden border border-white/5">
                          {member.profiles.avatar_url ? (
                            <img src={member.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            member.profiles.full_name?.charAt(0) || '?'
                          )}
                        </div>
                        <span className="text-xs font-semibold text-gray-200">{member.profiles.full_name || 'Unknown User'}</span>
                      </div>
                      <span className="text-[9px] font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-gray-400 capitalize">
                        {member.role || 'member'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Expense Tracking List */}
            <div className="glass p-6 rounded-[28px] border border-white/5 shadow-xl flex flex-col max-h-[460px]">
              <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                <History size={18} className="text-gray-400" />
                Payments Tracking List
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full ml-auto font-bold">{sortedExpenses.length}</span>
              </h3>

              {isExpensesLoading ? (
                <div className="py-10 flex justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                </div>
              ) : sortedExpenses.length === 0 ? (
                <div className="text-center py-12 flex-1 flex flex-col justify-center">
                  <p className="text-gray-500 text-sm">Chưa có chi phí nào được ghi nhận.</p>
                  <p className="text-xs text-gray-600 mt-1">Nhấn vào một ngày trên lịch để ghi nhận chi phí nước hoặc xe.</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto hide-scrollbar flex-1 pr-1">
                  {sortedExpenses.map(expense => {
                    const parsed = parseExpenseTitle(expense.title);
                    const profile = getProfileForLog(expense.created_by);
                    const isCreator = expense.created_by === user?.id;

                    const displayType = parsed.type === 'nước' ? 'Tiền Nước' : parsed.type === 'xe' ? 'Tiền Xe' : expense.title;
                    const typeIcon = parsed.type === 'nước' ? '💧' : parsed.type === 'xe' ? '🚗' : '💵';

                    return (
                      <div key={expense.id} className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5 hover:bg-black/30 transition-all group/item">
                        <div className="flex gap-3 items-center min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-lg shrink-0 border border-white/5">
                            {typeIcon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white truncate">{displayType}</span>
                              {parsed.date && (
                                <span className="text-[10px] text-gray-500 font-semibold bg-white/5 px-1.5 py-0.5 rounded border border-white/5 shrink-0 font-mono">
                                  {format(parseISO(parsed.date), 'dd/MM/yyyy')}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                              Ghi bởi <span className="text-blue-400 font-semibold">{profile.full_name || 'Thành viên'}</span>
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-black text-emerald-400 font-mono">
                            {formatVND(expense.amount)}
                          </span>
                          
                          {isCreator && (
                            <button
                              onClick={() => {
                                if (confirm('Bạn có chắc muốn xóa chi phí này?')) {
                                  deleteExpenseMutation.mutate(expense.id);
                                }
                              }}
                              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-lg opacity-0 group-hover/item:opacity-100 transition-opacity active:scale-95"
                              title="Xóa chi phí"
                            >
                              <Trash2 size={12} />
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
              <h3 className="text-xl font-bold text-white">Thêm thành viên ảo (Local Test)</h3>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Họ và tên</label>
                <input 
                  type="text" 
                  value={mockMemberName}
                  onChange={(e) => setMockMemberName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={addMockMemberMutation.isPending}
                className="w-full py-3.5 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-primary/20"
              >
                Thêm thành viên
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tracking Popup Modal */}
      {selectedDateForTracking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-neutral-900 border border-white/10 rounded-[28px] w-full max-w-md overflow-hidden shadow-2xl relative">
            <button 
              onClick={() => setSelectedDateForTracking(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
            
            <form onSubmit={handleTrackSubmit} className="p-6 md:p-8 space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white">Ghi nhận chi tiêu</h3>
                <p className="text-xs text-gray-400 mt-1 font-medium font-mono">
                  Ngày {format(selectedDateForTracking, 'dd/MM/yyyy')}
                </p>
              </div>

              <div className="space-y-4">
                {/* Type selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Loại chi phí</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTrackingType('nước')}
                      className={`py-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm transition-all ${
                        trackingType === 'nước' 
                          ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/5' 
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-base">💧</span> Tiền Nước
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrackingType('xe')}
                      className={`py-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm transition-all ${
                        trackingType === 'xe' 
                          ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-lg shadow-indigo-500/5' 
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-base">🚗</span> Tiền Xe
                    </button>
                  </div>
                </div>

                {/* Amount input with +/- 5000 steppers */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Số tiền (đ)</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        const current = parseFloat(trackingAmount) || 0;
                        const next = Math.max(0, current - 5000);
                        setTrackingAmount(next.toString());
                      }}
                      className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white rounded-l-xl text-gray-400 font-black active:scale-95 transition-all text-base px-4 shrink-0"
                    >
                      -
                    </button>
                    <input 
                      type="text"
                      inputMode="numeric"
                      value={formatInputAmount(trackingAmount)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setTrackingAmount(raw);
                      }}
                      placeholder="Ví dụ: 50.000" 
                      className="w-full bg-white/5 border-y border-white/10 py-3 text-white text-sm focus:outline-none text-center font-bold"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const current = parseFloat(trackingAmount) || 0;
                        const next = current + 5000;
                        setTrackingAmount(next.toString());
                      }}
                      className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white rounded-r-xl text-gray-400 font-black active:scale-95 transition-all text-base px-4 shrink-0"
                    >
                      +
                    </button>
                  </div>

                  {/* Quick select increments */}
                  <div className="flex gap-2 justify-center mt-2 flex-wrap">
                    {[10000, 20000, 50000, 100000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          const current = parseFloat(trackingAmount) || 0;
                          setTrackingAmount((current + val).toString());
                        }}
                        className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-[11px] font-semibold text-gray-300 border border-white/5 transition-all active:scale-95"
                      >
                        +{formatInputAmount(val.toString())}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDateForTracking(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-sm transition-all"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={addExpenseMutation.isPending}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20"
                >
                  {addExpenseMutation.isPending ? 'Đang lưu...' : 'Ghi nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
