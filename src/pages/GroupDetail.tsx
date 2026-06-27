import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchGroupMembers, fetchUserGroups, deleteGroup } from '../features/groups/api/groups-api';
import { ArrowLeft, Copy, Calendar as CalendarIcon, Users, Trash2, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';

export function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: fetchUserGroups
  });
  
  const group = groups?.find(g => g.id === id);

  const { data: members, isLoading } = useQuery({
    queryKey: ['group_members', id],
    queryFn: () => fetchGroupMembers(id!),
    enabled: !!id
  });

  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('Group deleted successfully!');
      navigate('/groups');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete group');
    }
  });

  const isOwner = group?.created_by === user?.id;

  if (!group) return null;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 pb-10">
      <div className="flex items-center gap-4 mt-6 md:mt-2 mb-8 md:mb-12">
        <button onClick={() => navigate('/groups')} className="p-2.5 md:p-3 rounded-xl md:rounded-2xl glass text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} className="md:w-7 md:h-7" />
        </button>
        <h2 className="text-2xl md:text-5xl font-bold tracking-tight truncate flex-1">{group.name}</h2>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 md:gap-10">
        
        {/* Left Column: Info & Actions */}
        <div className="lg:col-span-7 flex flex-col gap-6 md:gap-8">
          <div className="glass p-5 md:p-12 rounded-[24px] md:rounded-[48px] border border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-48 h-48 md:w-64 md:h-64 bg-primary/10 blur-[80px] rounded-full"></div>
            <p className="text-xs md:text-lg text-gray-400 mb-2 md:mb-4 font-bold uppercase tracking-widest relative z-10">Invite Code</p>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-3xl md:text-6xl font-mono font-bold tracking-[0.2em] text-primary">{group.invite_code.toUpperCase()}</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(group.invite_code);
                  toast.success('Invite code copied!');
                }} 
                className="p-3 md:p-6 rounded-xl md:rounded-[24px] bg-white/5 hover:bg-white/10 text-gray-300 transition-colors border border-white/10 active:scale-95 shrink-0"
              >
                <Copy size={20} className="md:w-8 md:h-8" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6">
            <Link to={`/availability/${group.id}`} className="flex-1 glass p-4 md:p-8 rounded-[20px] md:rounded-[36px] flex flex-col items-center justify-center gap-3 md:gap-4 hover:bg-card/80 transition-all border border-white/5 hover:scale-[1.02] shadow-xl text-center">
              <div className="p-3 md:p-5 bg-blue-500/20 text-blue-400 rounded-xl md:rounded-2xl shadow-inner"><CalendarIcon size={22} className="md:w-8 md:h-8" /></div>
              <span className="text-[13px] md:text-base font-bold text-white leading-tight">Set Availability</span>
            </Link>
            <Link to={`/match/${group.id}`} className="flex-1 glass p-4 md:p-8 rounded-[20px] md:rounded-[36px] flex flex-col items-center justify-center gap-3 md:gap-4 hover:bg-card/80 transition-all border border-white/5 hover:scale-[1.02] shadow-xl text-center">
              <div className="p-3 md:p-5 bg-purple-500/20 text-purple-400 rounded-xl md:rounded-2xl shadow-inner"><Users size={22} className="md:w-8 md:h-8" /></div>
              <span className="text-[13px] md:text-base font-bold text-white leading-tight">View Matches</span>
            </Link>
            <Link to={`/payments/${group.id}`} className="flex-1 glass p-4 md:p-8 rounded-[20px] md:rounded-[36px] flex flex-col items-center justify-center gap-3 md:gap-4 hover:bg-card/80 transition-all border border-white/5 hover:scale-[1.02] shadow-xl text-center">
              <div className="p-3 md:p-5 bg-emerald-500/20 text-emerald-400 rounded-xl md:rounded-2xl shadow-inner"><CreditCard size={22} className="md:w-8 md:h-8" /></div>
              <span className="text-[13px] md:text-base font-bold text-white leading-tight">Payments & Bills</span>
            </Link>
          </div>

          {isOwner && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to permanently delete this group? This cannot be undone.')) {
                  deleteMutation.mutate(group.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="w-full py-4 md:py-5 rounded-[20px] md:rounded-[40px] bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 font-bold text-sm md:text-lg flex items-center justify-center gap-2.5 transition-all shadow-xl active:scale-[0.98]"
            >
              <Trash2 size={20} className="md:w-6 md:h-6" />
              {deleteMutation.isPending ? 'Deleting Group...' : 'Delete Group'}
            </button>
          )}
        </div>

        {/* Right Column: Members */}
        <div className="lg:col-span-5">
          <div className="glass p-6 md:p-10 rounded-[32px] md:rounded-[48px] border border-white/5 h-full flex flex-col">
            <h3 className="font-bold text-xl md:text-2xl mb-6 md:mb-8 text-white flex items-center justify-between">
              Members 
              <span className="text-sm md:text-lg px-3 py-1 md:px-4 md:py-1.5 bg-white/10 rounded-full font-bold">{members?.length || 0}</span>
            </h3>
            
            {isLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 md:w-12 md:h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] md:max-h-[600px] overflow-y-auto hide-scrollbar pr-2 flex-1">
                {members?.map(member => (
                  <div key={member.user_id} className="flex items-center gap-4 md:gap-5 bg-black/20 p-4 md:p-5 rounded-2xl md:rounded-[24px] border border-white/5 transition-colors hover:bg-white/5">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center overflow-hidden shrink-0 border border-white/10 shadow-inner">
                      {member.profiles.avatar_url ? (
                        <img src={member.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-base md:text-xl font-bold text-white uppercase">{member.profiles.full_name?.charAt(0) || '?'}</span>
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-[16px] md:text-[20px] text-white truncate">{member.profiles.full_name || 'Unknown User'}</p>
                      <p className="text-sm md:text-base text-gray-500 mt-1 font-medium">Joined {new Date(member.joined_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
