import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saveAvailability } from '../features/scheduler/api/availability-api';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Save, Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { format, addDays, startOfToday, isSameDay, startOfWeek } from 'date-fns';
import toast from 'react-hot-toast';

export function Availability() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = startOfToday();

  const [pageOffset, setPageOffset] = useState(0);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [hasInitialized, setHasInitialized] = useState(false);

  const { data: existingSlots, isLoading } = useQuery({
    queryKey: ['my_availability', id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('group_id', id)
        .eq('user_id', user?.id);
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (existingSlots && !hasInitialized) {
      const initialSet = new Set<string>();
      existingSlots.forEach(slot => {
        initialSet.add(`${slot.available_date}|${slot.start_time}`);
      });
      setSelectedSlots(initialSet);
      setHasInitialized(true);
    }
  }, [existingSlots, hasInitialized]);

  const TIME_BLOCKS = [
    { label: 'MOR', start: '08:00:00', end: '12:00:00' },
    { label: 'AFT', start: '13:00:00', end: '17:00:00' },
    { label: 'EVE', start: '18:00:00', end: '22:00:00' },
  ];

  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const startDate = addDays(currentWeekStart, pageOffset * 7);
  const dates = [...Array(7)].map((_, i) => addDays(startDate, i));

  const mutation = useMutation({
    mutationFn: (slotsToSave: any[]) => saveAvailability(id!, slotsToSave),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability', id] });
      queryClient.invalidateQueries({ queryKey: ['my_availability', id] });
      toast.success('Availability saved successfully!');
      navigate(`/match/${id}`);
    }
  });

  const toggleSlot = (dateStr: string, start: string) => {
    const key = `${dateStr}|${start}`;
    const newSet = new Set(selectedSlots);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedSlots(newSet);
  };

  const handleSave = () => {
    if (!id) return;
    
    const slotsToSave = Array.from(selectedSlots).map(key => {
      const [date, start] = key.split('|');
      const block = TIME_BLOCKS.find(b => b.start === start);
      return {
        available_date: date,
        start_time: start,
        end_time: block!.end
      };
    });

    mutation.mutate(slotsToSave);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 pb-10">
      <div className="flex items-center justify-between mt-6 md:mt-2 mb-6 md:mb-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 md:p-3 rounded-xl md:rounded-2xl glass text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} className="md:w-6 md:h-6" />
          </button>
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight">Set Free Time</h2>
        </div>
        <button 
          onClick={handleSave}
          disabled={mutation.isPending || isLoading}
          className="bg-primary text-white p-2.5 px-5 md:p-4 md:px-8 rounded-xl md:rounded-2xl hover:bg-blue-600 active:scale-95 transition-all flex items-center gap-2 md:gap-3 shadow-lg shadow-primary/20 font-bold text-sm md:text-lg"
        >
          {mutation.isPending ? <Loader2 className="animate-spin w-5 h-5 md:w-6 md:h-6" /> : <Save size={18} className="md:w-6 md:h-6" />}
          Save
        </button>
      </div>

      <div className="flex items-center justify-between mb-6 md:mb-10 glass p-2 md:p-3 rounded-2xl md:rounded-3xl border border-white/5 shadow-lg max-w-2xl mx-auto w-full">
        <button 
          onClick={() => setPageOffset(prev => prev - 1)}
          className="p-2 md:p-3 rounded-xl md:rounded-2xl hover:bg-white/10 transition-colors"
        >
          <ChevronLeft size={20} className="md:w-6 md:h-6" />
        </button>
        <span className="font-bold text-[14px] md:text-lg text-gray-200">
          {format(dates[0], 'MMM d')} - {format(dates[6], 'MMM d, yyyy')}
        </span>
        <button 
          onClick={() => setPageOffset(prev => prev + 1)}
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
        <div className="glass rounded-[24px] md:rounded-[40px] p-4 md:p-10 border border-white/5 shadow-2xl relative overflow-hidden max-w-4xl mx-auto w-full">
          <div className="absolute -top-12 -right-12 md:-top-20 md:-right-20 w-40 h-40 md:w-80 md:h-80 bg-blue-500/10 blur-[80px] rounded-full"></div>
          
          <div className="flex">
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
                      <span className="text-[9px] md:text-sm uppercase font-bold text-gray-500 leading-tight md:mb-1">{format(date, 'EEE')}</span>
                      <span className={`text-[13px] md:text-xl font-bold mt-0.5 ${isSameDay(date, new Date()) ? 'text-primary' : 'text-gray-200'}`}>
                        {format(date, 'd')}
                      </span>
                    </div>

                    {TIME_BLOCKS.map(tb => {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const key = `${dateStr}|${tb.start}`;
                      const isSelected = selectedSlots.has(key);

                      return (
                        <button 
                          key={tb.label}
                          onClick={() => toggleSlot(dateStr, tb.start)}
                          className={`w-10 h-10 md:w-20 md:h-20 rounded-xl md:rounded-[20px] border transition-all duration-300 flex items-center justify-center relative active:scale-95 hover:scale-105 ${
                            isSelected 
                            ? 'bg-primary border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)] md:shadow-[0_0_25px_rgba(59,130,246,0.5)] z-10' 
                            : 'bg-white/5 border-white/5 text-transparent hover:bg-white/10'
                          }`}
                        >
                          {isSelected && <Check strokeWidth={3} size={16} className="md:w-8 md:h-8 animate-in zoom-in duration-200" />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-6 md:mt-10 pt-4 md:pt-8 border-t border-white/5 flex items-center justify-center gap-4 text-[10px] md:text-sm font-bold text-gray-400 uppercase tracking-widest">
            <p>Tap a square to toggle your availability</p>
          </div>
        </div>
      )}
    </div>
  );
}
