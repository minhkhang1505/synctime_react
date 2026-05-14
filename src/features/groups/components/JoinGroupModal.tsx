import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { joinGroup } from '../api/groups-api';
import { useUIStore } from '../../../store/useUIStore';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

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
      navigate(`/groups/${data.id}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to join group. Check the code.');
    }
  });

  if (!isJoinGroupOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="glass w-full max-w-md rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-2xl relative border border-white/10 animate-in zoom-in-95 duration-200">
        <button 
          onClick={() => setJoinGroupOpen(false)}
          className="absolute right-4 top-4 md:right-6 md:top-6 text-gray-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
        
        <h2 className="text-2xl font-bold mb-2">Join a Group</h2>
        <p className="text-gray-400 text-sm mb-6">Enter the 6-character invite code.</p>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(code); }}>
          <div className="mb-6">
            <input
              type="text"
              placeholder="e.g. A1B2C3"
              className="w-full bg-black/20 border border-white/10 rounded-xl md:rounded-2xl px-4 py-3 md:py-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-center text-xl tracking-widest uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              required
            />
          </div>

          <button
            type="submit"
            disabled={mutation.isPending || code.length < 6}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 md:py-4 px-4 rounded-xl md:rounded-2xl transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Joining...' : 'Join Group'}
          </button>
        </form>
      </div>
    </div>
  );
}
