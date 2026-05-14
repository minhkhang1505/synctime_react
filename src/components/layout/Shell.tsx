import { Outlet, Link, useLocation } from "react-router-dom";
import { Calendar, Users, Home as HomeIcon, Settings } from "lucide-react";
import { cn } from "../../lib/utils";

export function Shell() {
  const location = useLocation();
  
  const navItems = [
    { icon: HomeIcon, label: "Home", path: "/" },
    { icon: Users, label: "Groups", path: "/groups" },
    { icon: Calendar, label: "Availability", path: "/availability" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top Header */}
      <header className="px-6 py-4 flex items-center justify-between glass z-10 sticky top-0 border-b-0">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
          SyncTime
        </h1>
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 shadow-lg shadow-purple-500/20"></div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 pb-28">
        <div className="max-w-md mx-auto h-full relative">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 w-full glass pb-safe rounded-t-3xl border-t border-white/5">
        <div className="flex justify-around items-center p-2 max-w-md mx-auto relative">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-2xl transition-all duration-300 w-16",
                  isActive ? "text-primary bg-primary/10" : "text-gray-500 hover:text-gray-300"
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
