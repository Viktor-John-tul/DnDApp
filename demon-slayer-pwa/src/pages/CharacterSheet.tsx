import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CharacterService } from "../services/characterService";
import type { RPGCharacter } from "../types";
import { MainStatsTab } from "./tabs/MainStatsTab";
import { CombatTab } from "./tabs/CombatTab";
import { InventoryTab } from "./tabs/InventoryTab";
import { BioTab } from "./tabs/BioTab";
import { DeathScreen } from "../components/DeathScreen";
import { Shield, Swords, Backpack, Book, ChevronLeft, Loader2, Wifi } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { GameService } from "../services/gameService";

type TabId = 'stats' | 'combat' | 'inventory' | 'bio';

export function CharacterSheet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [character, setCharacter] = useState<RPGCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('stats');
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
     if (sessionCode && character) {
         // Debounce sync? or just fire and forget. 
         // Firestore writes are async. Frequent writes might be costly but for PWA demo it is fine.
         // Let's rely on handleUpdate mostly, but to be safe, we can sync here too.
         // Actually, if we use handleUpdate, we ensure we only sync when DATA changes, not when UI state changes.
         // But handleUpdate is passed down.
         // Let's hook into handleUpdate.
     }
  }, [character, sessionCode]);

  useEffect(() => {
    if (!id || !user) return;
    loadCharacter();
  }, [id, user]);

  const loadCharacter = async () => {
    try {
        if (!id) return;
        const char = await CharacterService.get(id);
        if (char) {
            setCharacter(char);
        } else {
            navigate('/dashboard'); // Not found
        }
    } catch (error) {
        console.error("Failed to load character", error);
    } finally {
        setLoading(false);
    }
  };

  const isReadOnly = (character && user) 
      ? (user.uid !== character.userId && character.type !== 'demon') 
      : true;

  const handleUpdate = (updates: Partial<RPGCharacter>) => {
    if (!character || !id) return;
    if (isReadOnly) return;
    
    // 1. Optimistic Update
    const updatedChar = { ...character, ...updates };
    setCharacter(updatedChar);

    // 2. Debounced Save
    if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
        CharacterService.update(id, updates);
        
        // 3. Sync to Game Session
        if (sessionCode) {
             GameService.syncCharacter(sessionCode, updatedChar);
        }
    }, 1000);
  };

  const handleJoinSession = async (code: string) => {
    if (!character) return;
    try {
        await GameService.joinGame(code, character);
        setSessionCode(code);
        setShowJoinModal(false);
    } catch (err) {
        console.error(err);
        alert("Failed to join. Check code.");
    }
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
    );
  }

  if (!character) return null;

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden relative">
        
        {character.currentHP <= 0 && (
            <DeathScreen character={character} onUpdate={handleUpdate} />
        )}

        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-30 shadow-sm">
            <button 
                onClick={() => navigate('/dashboard')}
                className="p-1 -ml-2 rounded-full active:bg-gray-100 text-gray-500"
            >
                <ChevronLeft size={24} />
            </button>
            <div className="flex-1 min-w-0">
                <h1 className="font-bold text-gray-900 truncate">
                    {character.name} {isReadOnly && <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 uppercase font-bold tracking-wider">View Only</span>}
                </h1>
                <p className="text-xs text-gray-500 truncate">
                    Lv.{character.level} {character.characterClass} • {character.breathingStyleName || "No Breath"}
                </p>
            </div>
            
            <button 
                onClick={() => setShowJoinModal(true)}
                className={`p-2 rounded-full ${sessionCode ? 'text-green-500 bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
            >
                <Wifi size={20} />
            </button>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {activeTab === 'stats' && <MainStatsTab character={character} onUpdate={handleUpdate} readOnly={isReadOnly} />}
            {activeTab === 'combat' && <CombatTab character={character} onUpdate={handleUpdate} readOnly={isReadOnly} />}
            {activeTab === 'inventory' && <InventoryTab character={character} onUpdate={handleUpdate} readOnly={isReadOnly} />}
            {activeTab === 'bio' && <BioTab character={character} onUpdate={handleUpdate} readOnly={isReadOnly} />}
        </main>

        {/* Bottom Navigation */}
        <nav className="bg-white border-t border-gray-200 px-6 py-2 pb-6 flex justify-between items-center z-30 sticky bottom-0">
            <TabButton 
                active={activeTab === 'stats'} 
                onClick={() => setActiveTab('stats')} 
                icon={<Shield size={24} />} 
                label="Stats" 
            />
            <TabButton 
                active={activeTab === 'combat'} 
                onClick={() => setActiveTab('combat')} 
                icon={<Swords size={24} />} 
                label="Combat" 
            />
            <TabButton 
                active={activeTab === 'inventory'} 
                onClick={() => setActiveTab('inventory')} 
                icon={<Backpack size={24} />} 
                label="Bag" 
            />
            <TabButton 
                active={activeTab === 'bio'} 
                onClick={() => setActiveTab('bio')} 
                icon={<Book size={24} />} 
                label="Bio" 
            />
        </nav>

        {showJoinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                  <h3 className="font-bold text-lg mb-4">Join Session</h3>
                  <input 
                    autoFocus
                    placeholder="Enter Code (e.g. A1B2C3)"
                    className="w-full p-3 border border-gray-300 rounded-xl mb-4 text-center font-mono uppercase text-xl font-bold tracking-widest"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleJoinSession((e.target as HTMLInputElement).value.toUpperCase());
                        }
                    }}
                  />
                  <div className="flex gap-2">
                      <button 
                        onClick={() => setShowJoinModal(false)}
                        className="flex-1 py-3 font-bold text-gray-500 bg-gray-100 rounded-xl"
                      >
                          Cancel
                      </button>
                      <button 
                         onClick={() => {
                             const input = document.querySelector('input[placeholder*="Code"]') as HTMLInputElement;
                             if(input) handleJoinSession(input.value.toUpperCase());
                         }}
                        className="flex-1 py-3 font-bold text-white bg-slayer-orange rounded-xl shadow-lg shadow-orange-200"
                      >
                          Connect
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
    return (
        <button 
            onClick={onClick}
            className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-black' : 'text-gray-300 hover:text-gray-500'}`}
        >
            <div className={`p-1 rounded-xl transition-all ${active ? 'bg-gray-100' : 'bg-transparent'}`}>
                {icon}
            </div>
            <span className="text-[10px] font-bold">{label}</span>
        </button>
    );
}
