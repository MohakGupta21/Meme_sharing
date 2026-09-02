import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Navbar } from "./components/Navbar";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Feed } from "./pages/Feed";
import { MemeDetail } from "./pages/MemeDetail";
import { Profile } from "./pages/Profile";
import { EditProfile } from "./pages/EditProfile";
import { Friends } from "./pages/Friends";
import { Search } from "./pages/Search";
import { Chat } from "./pages/Chat";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

function Shell() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/feed" element={<Feed />} />
          <Route path="/memes/:id" element={<MemeDetail />} />
          <Route path="/users/:id" element={<Profile />} />
          <Route path="/settings/profile" element={<EditProfile />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/search" element={<Search />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="*" element={<Navigate to="/feed" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/*" element={<Shell />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
