import { Users, CalendarPlus, ArrowRight, Calendar, LogOut } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { GoogleLoginButton } from "../features/auth/components/GoogleLoginButton";
import { supabase } from "../lib/supabase";
import { useUIStore } from "../store/useUIStore";
import { Link } from "react-router-dom";

export function Home() {
  const { user, isInitialized } = useAuthStore();
  const { setCreateGroupOpen, setJoinGroupOpen } = useUIStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!isInitialized) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col h-full animate-in fade-in duration-700 justify-center md:items-center pb-20">
        <div className="mb-12 space-y-3 text-center md:max-w-xl">
          <div className="w-20 h-20 md:w-32 md:h-32 rounded-[2rem] bg-gradient-to-tr from-blue-500 to-purple-500 mx-auto mb-8 md:mb-10 shadow-2xl shadow-purple-500/30"></div>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            SyncTime
          </h2>
          <p className="text-gray-400 text-sm md:text-lg leading-relaxed px-4 md:px-0">
            Coordinate schedules effortlessly with your friends and team. Realtime matching, zero hassle.
          </p>
        </div>

        <div className="px-4 w-full max-w-md">
          <GoogleLoginButton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700">
      <div className="mt-8 md:mt-2 mb-10 md:mb-16 flex justify-between items-start">
        <div className="space-y-2">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Hi, <span className="text-primary bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              {user.user_metadata?.full_name?.split(' ')[0] || 'Friend'}
            </span> 👋
          </h2>
          <p className="text-gray-400 text-sm md:text-xl leading-relaxed mt-2 font-medium">
            Ready to find time together?
          </p>
        </div>
        <button 
          onClick={handleLogout}
          className="p-3 md:p-4 rounded-2xl glass text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Sign out"
        >
          <LogOut size={20} className="md:w-6 md:h-6" />
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4 md:gap-8">
        <button 
          onClick={() => setCreateGroupOpen(true)}
          className="w-full relative group overflow-hidden rounded-[24px] md:rounded-[36px] glass p-6 md:p-10 flex items-center justify-between transition-all hover:bg-card/80 hover:scale-[1.02] border border-white/5 shadow-xl"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex items-center gap-5 md:gap-6 relative z-10">
            <div className="p-4 md:p-6 rounded-2xl md:rounded-[24px] bg-blue-500/20 text-blue-400 shadow-inner">
              <Users size={28} className="md:w-10 md:h-10" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-lg md:text-2xl text-white">Create a Group</h3>
              <p className="text-sm md:text-lg text-gray-400 mt-1.5">Start a new sync space</p>
            </div>
          </div>
          <ArrowRight className="text-gray-500 group-hover:text-white transition-colors md:w-8 md:h-8" />
        </button>

        <button 
          onClick={() => setJoinGroupOpen(true)}
          className="w-full relative group overflow-hidden rounded-[24px] md:rounded-[36px] glass p-6 md:p-10 flex items-center justify-between transition-all hover:bg-card/80 hover:scale-[1.02] border border-white/5 shadow-xl"
        >
           <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex items-center gap-5 md:gap-6 relative z-10">
            <div className="p-4 md:p-6 rounded-2xl md:rounded-[24px] bg-emerald-500/20 text-emerald-400 shadow-inner">
              <CalendarPlus size={28} className="md:w-10 md:h-10" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-lg md:text-2xl text-white">Join via Code</h3>
              <p className="text-sm md:text-lg text-gray-400 mt-1.5">Enter an invite code</p>
            </div>
          </div>
          <ArrowRight className="text-gray-500 group-hover:text-white transition-colors md:w-8 md:h-8" />
        </button>
      </div>
      
      <div className="mt-12 md:mt-20 glass p-8 md:p-14 rounded-[28px] md:rounded-[40px] border border-white/5 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 blur-[100px] rounded-full"></div>
        <h4 className="font-semibold text-sm md:text-xl text-gray-300 mb-8 flex items-center gap-3 relative z-10">
          <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-primary animate-pulse"></span>
          Quick Access
        </h4>
        <div className="flex flex-col md:flex-row items-center justify-center py-6 md:py-8 text-center md:text-left gap-6 md:gap-12 relative z-10">
          <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl md:rounded-[32px] bg-white/5 flex items-center justify-center border border-white/10 shrink-0 shadow-inner">
             <Calendar size={32} className="text-gray-400 md:w-12 md:h-12" />
          </div>
          <div>
            <p className="text-sm md:text-xl text-gray-300 font-medium leading-relaxed mb-5 md:mb-6">
              Head to Groups tab to see your teams<br className="hidden md:block"/> and start matching schedules!
            </p>
            <Link to="/groups" className="text-primary text-sm md:text-lg font-bold hover:text-white hover:bg-primary/20 px-6 py-3.5 md:px-8 md:py-4 rounded-xl md:rounded-2xl bg-primary/10 transition-all inline-block">View My Groups</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
