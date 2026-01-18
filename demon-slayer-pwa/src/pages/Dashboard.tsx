import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Plus, LogOut, Users, PlayCircle, Eye, Skull, Sword } from "lucide-react";
import { CharacterService } from "../services/characterService";
import { GameService } from "../services/gameService";
import type { RPGCharacter } from "../types";
import { CharacterCard } from "../components/CharacterCard";

export function Dashboard() {
  const { user, logout } = useAuth();
  const [characters, setCharacters] = useState<RPGCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'slayer' | 'demon'>('slayer');

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

  const filteredCharacters = characters.filter(c => (c.type || 'slayer') === viewMode);

  return (
    <div className={`min-h-screen p-4 pb-20 ${viewMode === 'demon' ? 'bg-gray-950' : 'bg-gray-100'}`}>
      <header className="flex justify-between items-center mb-6">
        <h1 className={`text-2xl font-bold ${viewMode === 'demon' ? 'text-red-600' : 'text-gray-900'}`}>
            {viewMode === 'demon' ? '12 Kizuki' : 'Slayer Corps'}
        </h1>
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

      {/* View Toggle */}
      <div className="flex bg-white/10 p-1 rounded-xl mb-6 backdrop-blur-sm border border-gray-200/20">
          <button 
             onClick={() => setViewMode('slayer')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${
                 viewMode === 'slayer' ? 'bg-white text-slayer-orange shadow-sm' : 'text-gray-400 hover:text-gray-200'
             }`}
          >
              <Sword size={16} /> Slayers
          </button>
          <button 
             onClick={() => setViewMode('demon')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${
                 viewMode === 'demon' ? 'bg-red-900 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
             }`}
          >
              <Skull size={16} /> Demons
          </button>
      </div>

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
            {filteredCharacters.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                    {viewMode === 'slayer' ? 'No slayers recruited.' : 'No demons summoned.'}
                </div>
            )}
            {filteredCharacters.map(char => (
                <CharacterCard key={char.id} character={char} onDelete={handleDelete} />
            ))}
            
            <Link 
            to={viewMode === 'slayer' ? "/create" : "/create-demon"}
            className={`p-4 rounded-2xl shadow-sm border flex items-center justify-center gap-2 font-bold transition ${
                viewMode === 'demon' 
                ? 'bg-red-900 border-red-800 text-white hover:bg-red-800' 
                : 'bg-white border-gray-200 text-slayer-orange hover:bg-orange-50'
            }`}
            >
            <Plus size={24} />
            {viewMode === 'slayer' ? 'Create Demon Slayer' : 'Summon Demon'}
            </Link>
        </div>
      )}
    </div>
  );
}
