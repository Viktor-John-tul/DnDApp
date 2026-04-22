import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Plus, LogOut, Users, PlayCircle, Eye, Sword, Settings, Moon, Sun, X } from "lucide-react";
import { CharacterService } from "../services/characterService";
import { CampaignService } from "../services/campaignService";
import type { RPGCharacter } from "../types";
import { CharacterCard } from "../components/CharacterCard";
import { useTheme } from "../context/ThemeContext";

export function Dashboard() {
  const { user, logout } = useAuth();
  const { isDark, toggleDarkMode } = useTheme();
  const [characters, setCharacters] = useState<RPGCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCampaignCount, setActiveCampaignCount] = useState(0);
  const [viewMode, setViewMode] = useState<'slayer' | 'npc'>('slayer');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (user) {
      loadCharacters();
      const unsubscribe = CampaignService.subscribeForDM(user.uid, (campaigns) => {
        const liveCount = campaigns.filter(campaign => campaign.activeSessionCode).length;
        setActiveCampaignCount(liveCount);
      });

      return () => unsubscribe();
    }
  }, [user]);

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

  const filteredCharacters = characters.filter(c => {
    const charType = c.type || 'slayer';
    if (viewMode === 'npc') return charType === 'demon' || charType === 'human';
    return charType === viewMode;
  });

  return (
    <div className={`min-h-screen p-4 pb-20 transition-colors ${viewMode === 'npc' ? 'bg-gray-950' : 'bg-gray-100 dark:bg-slate-950'}`}>
      <header className="flex justify-between items-center mb-6">
        <h1 className={`text-2xl font-bold ${viewMode === 'npc' ? 'text-purple-600' : 'text-gray-900 dark:text-gray-100'}`}>
            {viewMode === 'npc' ? 'NPCs' : 'Slayer Corps'}
        </h1>
        <div className="flex gap-2">
            <Link to="/dm" className={`p-2 rounded-full shadow-sm font-bold text-xs flex items-center gap-1 transition-colors ${activeCampaignCount > 0 ? 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:border-slate-600' : 'text-slayer-orange bg-white hover:bg-orange-50 dark:bg-slate-900 dark:border dark:border-slate-700 dark:hover:bg-slate-800'}`}>
              {activeCampaignCount > 0 ? <Eye size={16} /> : <Users size={16} />}
              {activeCampaignCount > 0 ? 'DM LIVE' : 'DM'}
            </Link>
           <button 
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-500 hover:text-gray-700 bg-white rounded-full shadow-sm dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white dark:border dark:border-slate-700"
            aria-label="Open settings"
            title="Settings"
          >
            <Settings size={20} />
          </button>
           <button 
            onClick={logout} 
            className="p-2 text-gray-500 hover:text-gray-700 bg-white rounded-full shadow-sm dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white dark:border dark:border-slate-700"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* View Toggle */}
        <div className="flex bg-white/10 dark:bg-slate-900/60 p-1 rounded-xl mb-6 backdrop-blur-sm border border-gray-200/20 dark:border-slate-700/60">
          <button 
             onClick={() => setViewMode('slayer')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${
             viewMode === 'slayer' ? 'bg-white text-slayer-orange shadow-sm dark:bg-slate-800 dark:text-orange-400' : 'text-gray-400 hover:text-gray-200 dark:hover:text-gray-100'
             }`}
          >
              <Sword size={16} /> Slayers
          </button>
          <button 
             onClick={() => setViewMode('npc')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${
                 viewMode === 'npc' ? 'bg-purple-900 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
             }`}
          >
              <Users size={16} /> NPCs
          </button>
      </div>

        {activeCampaignCount > 0 && (
        <div className="bg-gray-900 text-white rounded-xl p-4 mb-6 shadow-lg border border-gray-800 relative overflow-hidden">
           <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
             <Users size={120} />
           </div>
           <div className="relative z-10 flex justify-between items-center">
             <div>
               <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Active Campaign Sessions</div>
               <div className="text-3xl font-bold text-white">{activeCampaignCount}</div>
               <div className="flex items-center gap-1 text-xs text-green-400 mt-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Live
               </div>
             </div>
             <Link to="/dm" className="bg-slayer-orange text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-orange-600 transition-colors shadow-lg shadow-orange-900/20">
               Manage <PlayCircle size={16} />
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
                    {viewMode === 'slayer' ? 'No slayers recruited.' : 'No NPCs created.'}
                </div>
            )}
            {filteredCharacters.map(char => (
                <CharacterCard key={char.id} character={char} onDelete={handleDelete} />
            ))}
            
            <Link 
            to={viewMode === 'slayer' ? "/create" : "/create-demon"}
            className={`p-4 rounded-2xl shadow-sm border flex items-center justify-center gap-2 font-bold transition ${
                viewMode === 'npc' 
                ? 'bg-purple-900 border-purple-800 text-white hover:bg-purple-800' 
                : 'bg-white border-gray-200 text-slayer-orange hover:bg-orange-50'
            }`}
            >
            <Plus size={24} />
            {viewMode === 'slayer' ? 'Create Demon Slayer' : 'Create NPC'}
            </Link>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:text-gray-200"
                aria-label="Close settings"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <button
                onClick={toggleDarkMode}
                className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 dark:bg-slate-800 dark:border-slate-700 px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div>
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">Dark Mode</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">{isDark ? "Enabled" : "Disabled"}</div>
                </div>
                <div className={`inline-flex items-center gap-1 text-sm font-bold ${isDark ? "text-slate-200" : "text-amber-500"}`}>
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                  {isDark ? "On" : "Off"}
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
