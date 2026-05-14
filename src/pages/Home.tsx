import { Users, CalendarPlus, ArrowRight, Calendar, LogOut } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { GoogleLoginButton } from "../features/auth/components/GoogleLoginButton";
import { supabase } from "../lib/supabase";

export function Home() {
  const { user, isInitialized } = useAuthStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Loading state while checking session
  if (!isInitialized) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  // Not logged in state
  if (!user) {
    return (
      <div className="flex flex-col h-full animate-in fade-in duration-700 justify-center pb-20">
        <div className="mb-12 space-y-3 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-500 to-purple-500 mx-auto mb-8 shadow-xl shadow-purple-500/20"></div>
          <h2 className="text-4xl font-bold tracking-tight">
            SyncTime
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed px-4">
            Coordinate schedules effortlessly with your friends and team. Realtime matching, zero hassle.
          </p>
        </div>

        <div className="px-4">
          <GoogleLoginButton />
        </div>
      </div>
    );
  }

  // Logged in state
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700">
      {/* Welcome Header */}
      <div className="mt-8 mb-10 flex justify-between items-start">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">
            Hi, <span className="text-primary bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              {user.user_metadata?.full_name?.split(' ')[0] || 'Friend'}
            </span> 👋
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Ready to find time together?
          </p>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2 rounded-full glass text-gray-400 hover:text-white transition-colors"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="space-y-4">
        <button className="w-full relative group overflow-hidden rounded-[24px] glass p-5 flex items-center justify-between transition-all hover:bg-card/80 active:scale-[0.98] border border-white/5 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3.5 rounded-2xl bg-blue-500/20 text-blue-400 shadow-inner">
              <Users size={24} />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-[17px] text-white">Create a Group</h3>
              <p className="text-sm text-gray-400 mt-0.5">Start a new sync space</p>
            </div>
          </div>
          <ArrowRight className="text-gray-500 group-hover:text-white transition-colors" />
        </button>

        <button className="w-full relative group overflow-hidden rounded-[24px] glass p-5 flex items-center justify-between transition-all hover:bg-card/80 active:scale-[0.98] border border-white/5 shadow-xl">
           <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3.5 rounded-2xl bg-emerald-500/20 text-emerald-400 shadow-inner">
              <CalendarPlus size={24} />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-[17px] text-white">Join via Code</h3>
              <p className="text-sm text-gray-400 mt-0.5">Enter an invite code</p>
            </div>
          </div>
          <ArrowRight className="text-gray-500 group-hover:text-white transition-colors" />
        </button>
      </div>
      
      {/* Upcoming Section */}
      <div className="mt-12 glass p-6 rounded-[28px] border border-white/5 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary/20 blur-3xl rounded-full"></div>
        <h4 className="font-semibold text-sm text-gray-300 mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          Upcoming Syncs
        </h4>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4 border border-white/10">
             <Calendar size={24} className="text-gray-500" />
          </div>
          <p className="text-sm text-gray-500 font-medium leading-relaxed">
            No upcoming events. <br/>
            Create a group to get started.
          </p>
        </div>
      </div>
    </div>
  );
}
