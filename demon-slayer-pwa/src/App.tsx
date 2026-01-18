import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { CharacterCreation } from "./pages/CharacterCreation";
import { DemonCreation } from "./pages/DemonCreation";
import { CharacterSheet } from "./pages/CharacterSheet";
import { DMView } from "./pages/multiplayer/DMView";

function App() {
  return (
    <AuthProvider>
      <HashRouter>
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
    </AuthProvider>
  );
}

export default App;
