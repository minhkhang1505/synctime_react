import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { joinGroup } from '../api/groups-api';
import { useUIStore } from '../../../store/useUIStore';
import { Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function JoinGroupModal() {
  const { isJoinGroupOpen, setJoinGroupOpen } = useUIStore();
  const [code, setCode] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: joinGroup,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setJoinGroupOpen(false);
      setCode('');
      navigate(`/groups/${data.id}`);
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to join group. Check the code.');
    }
  });

  if (!isJoinGroupOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-sm glass rounded-[32px] p-6 border border-white/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button 
          onClick={() => setJoinGroupOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <X size={20} className="text-gray-400" />
        </button>
        <h2 className="text-2xl font-bold mb-6">Join Group</h2>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(code); }}>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 px-1">Invite Code</label>
              <input 
                type="text" 
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. a1b2c3" 
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono tracking-[0.2em] text-lg text-center shadow-inner uppercase"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={mutation.isPending || !code.trim()}
              className="w-full bg-emerald-500 text-white font-medium px-4 py-4 rounded-2xl hover:bg-emerald-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              {mutation.isPending ? <Loader2 className="animate-spin w-5 h-5" /> : null}
              Join Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
