import { HashRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ConfirmProvider } from "./context/ConfirmContext";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { CharacterCreation } from "./pages/CharacterCreation";
import { DemonCreation } from "./pages/DemonCreation";
import { CharacterSheet } from "./pages/CharacterSheet";
import { DMView } from "./pages/multiplayer/DMView";
import { DMCampaigns } from "./pages/multiplayer/DMCampaigns";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "dndapp-theme";

function App() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const startDark = storedTheme ? storedTheme === "dark" : prefersDark;
    setIsDark(startDark);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem(THEME_KEY, "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem(THEME_KEY, "light");
    }
  }, [isDark]);

  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <HashRouter>
            <button
              onClick={() => setIsDark((prev) => !prev)}
              className="fixed top-4 right-4 z-[120] w-11 h-11 rounded-full border border-gray-200 bg-white text-gray-600 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition"
              aria-label="Toggle dark mode"
              title="Toggle dark mode"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Routes>
            <Route path="/login" element={<LoginPage />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/create" element={
            <ProtectedRoute>
              <CharacterCreation />
            </ProtectedRoute>
          } />

          <Route path="/create-demon" element={
            <ProtectedRoute>
              <DemonCreation />
            </ProtectedRoute>
          } />
          
          <Route path="/dm" element={
            <ProtectedRoute>
              <DMCampaigns />
            </ProtectedRoute>
          } />

          <Route path="/dm/:campaignId" element={
            <ProtectedRoute>
              <DMView />
            </ProtectedRoute>
          } />

          <Route path="/character/:id" element={
            <ProtectedRoute>
              <CharacterSheet />
            </ProtectedRoute>
          } />
          </Routes>
          </HashRouter>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
