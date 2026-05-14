import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createGroup } from '../api/groups-api';
import { useUIStore } from '../../../store/useUIStore';
import { Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function CreateGroupModal() {
  const { isCreateGroupOpen, setCreateGroupOpen } = useUIStore();
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: createGroup,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setCreateGroupOpen(false);
      setName('');
      navigate(`/groups/${data.id}`);
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to create group');
    }
  });

  if (!isCreateGroupOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-sm glass rounded-[32px] p-6 border border-white/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button 
          onClick={() => setCreateGroupOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <X size={20} className="text-gray-400" />
        </button>
        <h2 className="text-2xl font-bold mb-6">New Group</h2>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(name); }}>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 px-1">Group Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekend Trip" 
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={mutation.isPending || !name.trim()}
              className="w-full bg-primary text-white font-medium px-4 py-4 rounded-2xl hover:bg-blue-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
            >
              {mutation.isPending ? <Loader2 className="animate-spin w-5 h-5" /> : null}
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
