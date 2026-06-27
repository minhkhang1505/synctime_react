import { Outlet, Link, useLocation } from "react-router-dom";
import { Users, Home as HomeIcon, Bell } from "lucide-react";
import { cn } from "../../lib/utils";
import { CreateGroupModal } from "../../features/groups/components/CreateGroupModal";
import { JoinGroupModal } from "../../features/groups/components/JoinGroupModal";
import { useNotificationStore } from "../../store/useNotificationStore";
import { useNotificationListener } from "../../store/useNotificationListener";

export function Shell() {
  const location = useLocation();

  const { unreadCount } = useNotificationStore();
  useNotificationListener();

  const count = unreadCount();

  const navItems = [
    { icon: HomeIcon, label: "Home", path: "/" },
    { icon: Users, label: "Groups", path: "/groups" },
    { icon: Bell, label: "Notifications", path: "/notifications", badge: count > 0 ? count : null },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 glass border-r border-white/5 z-20 relative">
        <div className="p-8 pb-6">
          <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 shadow-lg shadow-purple-500/20"></div>
            SyncTime
          </h1>
        </div>
        <nav className="flex-1 px-5 py-6 space-y-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.path}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 relative",
                  isActive ? "text-primary bg-primary/10 font-bold" : "text-gray-400 hover:text-gray-200 hover:bg-white/5 font-medium"
                )}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[16px] tracking-wide">{item.label}</span>
                {item.badge && (
                  <span className="absolute top-3 right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

        {/* Mobile Header */}
        <div className="md:hidden sticky top-0 z-20 px-4 py-2.5">
          <header className="px-5 py-3 flex items-center justify-between glass rounded-[44px] border border-white/10 shadow-lg">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              SyncTime
            </h1>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 shadow-lg shadow-purple-500/20"></div>
          </header>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-10 pb-28 md:pb-10">
          <div className="max-w-[1200px] mx-auto min-h-full relative">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-20">
          <nav className="glass rounded-full border border-white/10 shadow-2xl backdrop-blur-xl bg-background/60">
            <div className="flex justify-around items-center p-2 max-w-md mx-auto relative">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-full transition-all duration-300 w-16 relative",
                      isActive ? "text-primary bg-primary/10" : "text-gray-500 hover:text-gray-300"
                    )}
                  >
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
                    {item.badge && (
                      <span className="absolute top-1 right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      <CreateGroupModal />
      <JoinGroupModal />
    </div>
  );
}
