import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Shell } from "./components/layout/Shell";
import { Home } from "./pages/Home";
import { Groups } from "./pages/Groups";
import { GroupDetail } from "./pages/GroupDetail";
import { Availability } from "./pages/Availability";
import { Match } from "./pages/Match";
import { Notifications } from "./pages/Notifications";
import { AuthProvider } from "./features/auth/components/AuthProvider";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Shell />}>
              <Route index element={<Home />} />
              <Route path="groups" element={<Groups />} />
              <Route path="groups/:id" element={<GroupDetail />} />
              <Route path="availability/:id" element={<Availability />} />
              <Route path="match/:id" element={<Match />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="settings" element={<div className="p-4 text-center text-gray-400 mt-20">Settings coming soon</div>} />
            </Route>
          </Routes>
          <Toaster 
            position="top-center" 
            toastOptions={{
              style: {
                background: '#1f2937',
                color: '#fff',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
