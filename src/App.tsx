import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Shell } from "./components/layout/Shell";
import { Home } from "./pages/Home";
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
              {/* Dummy routes for bottom nav testing */}
              <Route path="groups" element={<div className="p-4 text-center text-gray-400 mt-20">Groups coming soon</div>} />
              <Route path="availability" element={<div className="p-4 text-center text-gray-400 mt-20">Availability coming soon</div>} />
              <Route path="settings" element={<div className="p-4 text-center text-gray-400 mt-20">Settings coming soon</div>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
