import { useQuery } from '@tanstack/react-query';
import { fetchUserGroups } from '../features/groups/api/groups-api';
import { Users, Plus, Hash } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUIStore } from '../store/useUIStore';

export function Groups() {
  const { setCreateGroupOpen, setJoinGroupOpen } = useUIStore();
  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: fetchUserGroups
  });

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 pb-10">
      <div className="mt-6 md:mt-2 mb-8 md:mb-14 flex justify-between items-center">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Nhóm Của Bạn</h2>
        <div className="flex gap-3">
           <button onClick={() => setJoinGroupOpen(true)} title="Tham gia nhóm" className="p-3 md:p-4 rounded-xl md:rounded-2xl glass text-emerald-400 hover:text-emerald-300 hover:bg-white/10 transition-colors">
             <Hash size={20} className="md:w-6 md:h-6" />
           </button>
           <button onClick={() => setCreateGroupOpen(true)} title="Tạo nhóm mới" className="p-3 md:p-4 rounded-xl md:rounded-2xl glass text-blue-400 hover:text-blue-300 hover:bg-white/10 transition-colors">
             <Plus size={20} className="md:w-6 md:h-6" />
           </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
      ) : groups?.length === 0 ? (
        <div className="glass p-10 md:p-20 rounded-[32px] md:rounded-[48px] text-center border border-white/5 shadow-2xl mt-10 md:mt-16 max-w-2xl mx-auto">
           <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-white/5 mx-auto flex items-center justify-center mb-6 border border-white/10">
             <Users size={36} className="text-gray-500 md:w-14 md:h-14" />
           </div>
           <h3 className="text-xl md:text-3xl font-bold mb-4 text-white">Chưa có nhóm nào</h3>
           <p className="text-sm md:text-xl text-gray-400 mb-8 md:mb-12">Tạo nhóm mới hoặc tham gia nhóm để bắt đầu lên lịch rảnh cùng nhau.</p>
           <button onClick={() => setCreateGroupOpen(true)} className="bg-primary text-white px-8 py-4 md:px-10 md:py-5 rounded-2xl md:rounded-3xl text-sm md:text-lg font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20">
             Tạo Nhóm
           </button>
        </div>
      ) : (
        <div className="grid gap-4 md:gap-8 md:grid-cols-2 xl:grid-cols-3">
          {groups?.map((group) => (
            <Link key={group.id} to={`/groups/${group.id}`} className="group relative overflow-hidden rounded-[24px] md:rounded-[36px] glass p-6 md:p-8 transition-all hover:bg-card/80 hover:scale-[1.02] border border-white/5 block shadow-xl">
              <div className="flex items-center justify-between relative z-10">
                <div className="flex-1 pr-4">
                  <h3 className="font-bold text-[19px] md:text-[24px] text-white group-hover:text-primary transition-colors truncate">{group.name}</h3>
                  <p className="text-xs md:text-sm text-gray-400 mt-2.5 font-mono bg-black/40 inline-block px-3 py-1.5 md:px-4 md:py-2 rounded-lg tracking-[0.1em] border border-white/5">
                    MÃ MỜI: <span className="text-white ml-1 font-bold">{group.invite_code.toUpperCase()}</span>
                  </p>
                </div>
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-primary/20 group-hover:text-primary transition-all shrink-0 border border-white/5 shadow-inner">
                  <Users size={22} className="md:w-7 md:h-7" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
