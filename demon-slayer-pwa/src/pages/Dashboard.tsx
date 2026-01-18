import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Plus, LogOut, Users, PlayCircle, Eye } from "lucide-react";
import { CharacterService } from "../services/characterService";
import { GameService } from "../services/gameService";
import type { RPGCharacter } from "../types";
import { CharacterCard } from "../components/CharacterCard";

export function Dashboard() {
  const { user, logout } = useAuth();
  const [characters, setCharacters] = useState<RPGCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadCharacters();
      checkActiveSession();
    }
  }, [user]);

  async function checkActiveSession() {
      if (!user) return;
      const code = await GameService.resumeSession(user.uid);
      setActiveSession(code);
  }

  async function loadCharacters() {
    if (!user) return;
    try {
      const data = await CharacterService.getAll(user.uid);
      setCharacters(data);
    } catch (error) {
      console.error("Failed to load characters", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await CharacterService.delete(id);
      setCharacters(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error("Failed to delete", error);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 pb-20">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Slayer Corps</h1>
        <div className="flex gap-2">
           <Link to="/dm" className={`p-2 rounded-full shadow-sm font-bold text-xs flex items-center gap-1 transition-colors ${activeSession ? 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700' : 'text-slayer-orange bg-white hover:bg-orange-50'}`}>
              {activeSession ? <Eye size={16} /> : <Users size={16} />} 
              {activeSession ? 'DM VIEW' : 'DM'}
           </Link>
           <button 
            onClick={logout} 
            className="p-2 text-gray-500 hover:text-gray-700 bg-white rounded-full shadow-sm"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {activeSession && (
        <div className="bg-gray-900 text-white rounded-xl p-4 mb-6 shadow-lg border border-gray-800 relative overflow-hidden">
             <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
                 <Users size={120} />
             </div>
             <div className="relative z-10 flex justify-between items-center">
                 <div>
                     <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Active Session</div>
                     <div className="font-mono text-3xl font-bold text-white tracking-widest">{activeSession}</div>
                     <div className="flex items-center gap-1 text-xs text-green-400 mt-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Live
                     </div>
                 </div>
                 <Link to="/dm" className="bg-slayer-orange text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-orange-600 transition-colors shadow-lg shadow-orange-900/20">
                     Resume <PlayCircle size={16} />
                 </Link>
             </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-slayer-orange"></div>
        </div>
      ) : (
        <div className="space-y-4">
            {characters.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                    No characters found. Start your journey!
                </div>
            )}
            {characters.map(char => (
                <CharacterCard key={char.id} character={char} onDelete={handleDelete} />
            ))}
            
            <Link 
            to="/create"
            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-center gap-2 text-slayer-orange font-bold hover:bg-orange-50 transition"
            >
            <Plus size={24} />
            Create Demon Slayer
            </Link>
        </div>
      )}
    </div>
  );
}
