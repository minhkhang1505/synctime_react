import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAvailability, subscribeToAvailability } from '../features/scheduler/api/availability-api';
import { fetchGroupMembers } from '../features/groups/api/groups-api';
import { ArrowLeft, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, startOfToday, isSameDay, startOfWeek } from 'date-fns';
import { vi } from 'date-fns/locale';

export function Match() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [pageOffset, setPageOffset] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{ date: string, label: string, userIds: Set<string> } | null>(null);

  const { data: members } = useQuery({
    queryKey: ['group_members', id],
    queryFn: () => fetchGroupMembers(id!)
  });

  const { data: slots, isLoading } = useQuery({
    queryKey: ['availability', id],
    queryFn: () => fetchAvailability(id!)
  });

  useEffect(() => {
    if (id) {
      const channel = subscribeToAvailability(id, () => {
        queryClient.invalidateQueries({ queryKey: ['availability', id] });
      });
      return () => { channel.unsubscribe(); };
    }
  }, [id, queryClient]);

  const totalMembers = members?.length || 0;
  
  const matchesMap = slots?.reduce((acc, slot) => {
    const key = `${slot.available_date}|${slot.start_time}`;
    if (!acc[key]) acc[key] = new Set();
    acc[key].add(slot.user_id);
    return acc;
  }, {} as Record<string, Set<string>>) || {};

  const TIME_BLOCKS = [
    { label: 'Sáng', start: '08:00:00' },
    { label: 'Chiều', start: '13:00:00' },
    { label: 'Tối', start: '18:00:00' },
  ];

  const today = startOfToday();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const startDate = addDays(currentWeekStart, pageOffset * 7);
  const dates = [...Array(7)].map((_, i) => addDays(startDate, i));

  const getColorClass = (count: number, total: number) => {
    if (total === 0 || count === 0) return 'bg-white/5 border-white/5 text-transparent'; 
    if (count === total && total > 1) return 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-105 z-10'; 
    return 'bg-amber-500/20 border-amber-500/30 text-amber-400'; 
  };

  return (
    <div className="flex flex-col min-h-full animate-in fade-in duration-500 pb-10">
      <div className="flex items-center gap-4 mt-6 md:mt-2 mb-6 md:mb-10">
        <button onClick={() => navigate(-1)} className="p-2 md:p-3 rounded-xl md:rounded-2xl glass text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} className="md:w-6 md:h-6" />
        </button>
        <h2 className="text-2xl md:text-4xl font-bold tracking-tight flex-1">Biểu Đồ Lịch Khớp</h2>
        <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm md:text-base font-bold">
          <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Trực tiếp
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 md:mb-10 glass p-2 md:p-3 rounded-2xl md:rounded-3xl border border-white/5 shadow-lg max-w-2xl mx-auto w-full">
        <button 
          onClick={() => { setPageOffset(prev => prev - 1); setSelectedCell(null); }}
          className="p-2 md:p-3 rounded-xl md:rounded-2xl hover:bg-white/10 transition-colors"
        >
          <ChevronLeft size={20} className="md:w-6 md:h-6" />
        </button>
        <span className="font-bold text-[14px] md:text-lg text-gray-200">
          {format(dates[0], 'd MMM', { locale: vi })} - {format(dates[6], 'd MMM, yyyy', { locale: vi })}
        </span>
        <button 
          onClick={() => { setPageOffset(prev => prev + 1); setSelectedCell(null); }}
          className="p-2 md:p-3 rounded-xl md:rounded-2xl hover:bg-white/10 transition-colors"
        >
          <ChevronRight size={20} className="md:w-6 md:h-6" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 md:w-12 md:h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
      ) : (
        <div className="glass rounded-[24px] md:rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden max-w-[1200px] mx-auto w-full flex flex-col lg:flex-row">
          <div className="absolute -top-12 -right-12 md:-top-20 md:-right-20 w-40 h-40 md:w-80 md:h-80 bg-emerald-500/10 blur-[80px] rounded-full"></div>
          
          <div className="p-4 md:p-10 flex-1 min-w-0">
            <div className="flex lg:justify-center">
              <div className="flex flex-col justify-end gap-1.5 md:gap-4 mr-2 md:mr-6 pb-1 md:pb-2 pt-10 md:pt-16">
                {TIME_BLOCKS.map(tb => (
                  <div key={tb.label} className="h-10 md:h-20 flex items-center justify-end">
                    <span className="text-[10px] md:text-sm font-bold text-gray-400 uppercase tracking-widest">{tb.label}</span>
                  </div>
                ))}
              </div>

              <div className="flex-1 overflow-x-auto hide-scrollbar pb-2">
                <div className="flex gap-1.5 md:gap-4 min-w-max">
                  {dates.map((date, i) => (
                    <div key={i} className="flex flex-col gap-1.5 md:gap-4">
                      <div className="h-10 md:h-16 flex flex-col items-center justify-center">
                        <span className="text-[9px] md:text-sm uppercase font-bold text-gray-500 leading-tight md:mb-1">{format(date, 'EEEE', { locale: vi })}</span>
                        <span className={`text-[13px] md:text-xl font-bold mt-0.5 ${isSameDay(date, new Date()) ? 'text-primary' : 'text-gray-200'}`}>
                          {format(date, 'd')}
                        </span>
                      </div>

                      {TIME_BLOCKS.map(tb => {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        const key = `${dateStr}|${tb.start}`;
                        const userIds = matchesMap[key] || new Set();
                        const count = userIds.size;
                        const isPerfect = count === totalMembers && totalMembers > 1;
                        
                        const isSelected = selectedCell?.date === dateStr && selectedCell?.label === tb.label;

                        return (
                          <button 
                            key={tb.label}
                            onClick={() => setSelectedCell({ date: dateStr, label: tb.label, userIds })}
                            className={`w-10 h-10 md:w-20 md:h-20 rounded-xl md:rounded-[20px] border transition-all duration-300 flex items-center justify-center relative hover:scale-105 ${getColorClass(count, totalMembers)} ${isSelected ? 'ring-2 md:ring-4 ring-primary ring-offset-2 md:ring-offset-4 ring-offset-transparent' : ''}`}
                            title={`${count}/${totalMembers} thành viên rảnh`}
                          >
                            {isPerfect && <Sparkles size={10} className="md:w-6 md:h-6 absolute -top-1 -right-1 md:-top-2 md:-right-2 text-yellow-400 animate-pulse drop-shadow-md" />}
                            {count > 0 && (
                              <span className="font-bold text-[13px] md:text-2xl">{count}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-4 md:mt-8 pt-4 md:pt-8 border-t border-white/5 flex items-center justify-center gap-4 md:gap-8 text-[10px] md:text-sm font-bold text-gray-400 uppercase tracking-widest flex-wrap">
              <div className="flex items-center gap-1.5 md:gap-3"><div className="w-3 h-3 md:w-5 md:h-5 rounded md:rounded-md bg-white/5 border border-white/10"></div> Bận</div>
              <div className="flex items-center gap-1.5 md:gap-3"><div className="w-3 h-3 md:w-5 md:h-5 rounded md:rounded-md bg-amber-500/20 border border-amber-500/30"></div> Khớp 1 phần</div>
              <div className="flex items-center gap-1.5 md:gap-3"><div className="w-3 h-3 md:w-5 md:h-5 rounded md:rounded-md bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> Khớp hoàn hảo</div>
            </div>
          </div>

          {selectedCell && (
            <div className="bg-black/20 p-6 md:p-10 border-t lg:border-t-0 lg:border-l border-white/5 animate-in fade-in slide-in-from-top-2 lg:slide-in-from-right-8 lg:slide-in-from-top-0 lg:w-[320px] xl:w-[380px] shrink-0">
              <div className="flex items-center justify-between mb-4 lg:mb-8">
                <h4 className="text-[13px] md:text-lg font-bold text-primary tracking-wide">
                  {format(new Date(selectedCell.date), 'EEEE, d MMM', { locale: vi })} <span className="mx-2 text-white/20">•</span> {selectedCell.label}
                </h4>
                <span className="text-xs md:text-base text-gray-400 font-bold tracking-wider shrink-0 ml-2">{selectedCell.userIds.size}/{totalMembers} RẢNH</span>
              </div>
              
              {selectedCell.userIds.size === 0 ? (
                <p className="text-sm md:text-base text-gray-500 font-medium mt-2">Không có thành viên nào rảnh vào lúc này.</p>
              ) : (
                <div className="flex flex-wrap gap-3 md:gap-4 mt-2 lg:flex-col">
                  {(() => {
                    const freeMembers = members?.filter(m => selectedCell.userIds.has(m.user_id));
                    if (!freeMembers || freeMembers.length === 0) {
                       return <span className="text-sm text-gray-400 italic">Error matching user profiles...</span>;
                    }
                    return freeMembers.map(member => (
                      <div key={member.user_id} className="flex items-center gap-2 md:gap-3 bg-white/5 pr-4 md:pr-5 pl-1.5 py-1.5 md:py-2 rounded-full border border-white/10 shadow-sm hover:bg-white/10 transition-colors w-auto lg:w-full">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-[12px] md:text-sm font-bold text-white overflow-hidden shrink-0 border border-white/20">
                          {member.profiles?.avatar_url ? (
                            <img src={member.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            member.profiles?.full_name?.charAt(0)?.toUpperCase() || '?'
                          )}
                        </div>
                        <span className="text-sm md:text-base font-bold text-gray-200 truncate">{member.profiles?.full_name || 'Unknown'}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
