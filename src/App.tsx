import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Shell } from "./components/layout/Shell";
import { Home } from "./pages/Home";
import { Groups } from "./pages/Groups";
import { GroupDetail } from "./pages/GroupDetail";
import { Availability } from "./pages/Availability";
import { Match } from "./pages/Match";
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
              <Route path="settings" element={<div className="p-4 text-center text-gray-400 mt-20">Settings coming soon</div>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
