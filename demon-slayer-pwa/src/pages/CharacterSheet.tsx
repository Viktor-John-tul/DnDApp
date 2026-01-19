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
import { useToast } from "../context/ToastContext";

type TabId = 'stats' | 'combat' | 'inventory' | 'bio';

export function CharacterSheet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [character, setCharacter] = useState<RPGCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('stats');
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCharacterRef = useRef<RPGCharacter | null>(null);

  // Notification Listener
  useEffect(() => {
      if (!character) return;
      
      const prev = prevCharacterRef.current;
      if (prev) {
          // Check for received items (From DM)
          if (character.inventory.length > prev.inventory.length) {
              const newItems = character.inventory.filter(item => 
                  !prev.inventory.some(p => p.id === item.id)
              );
              
              newItems.forEach(item => {
                  if (item.description === "Given by DM") {
                      showToast(`Received item: ${item.name} (x${item.quantity}) from DM`, 'success');
                  }
              });
          }

          // Check for Gold changes
          if (character.gold !== prev.gold && prev.gold !== undefined) {
               const diff = character.gold - prev.gold;
               if (diff > 0) showToast(`Received ${diff} Gold`, 'success');
               else if (diff < 0) showToast(`Lost ${Math.abs(diff)} Gold`, 'info');
          }

          // Check for DM Note changes
          if (character.dmNotes !== prev.dmNotes && prev.dmNotes !== undefined) {
               showToast("DM updated your private notes", 'info');
          }

          // Check for HP changes
          if (character.currentHP !== prev.currentHP && prev.currentHP !== undefined) {
               const diff = character.currentHP - prev.currentHP;
               if (diff < 0) {
                   showToast(`Took ${Math.abs(diff)} Damage!`, 'error');
               } else if (diff > 0) {
                   showToast(`Healed ${diff} HP`, 'success');
               }
          }
      }
      
      prevCharacterRef.current = character;
  }, [character]);

  useEffect(() => {
    if (!id || !user) return;
    
    // Subscribe to realtime updates
    const unsubscribe = CharacterService.subscribe(id, (char) => {
        if (char) {
            setCharacter(char);
            setLoading(false);
        } else {
             // Deleted or not found
             navigate('/');
        }
    });

    return () => unsubscribe();
  }, [id, user]);

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
        if (updatedChar.activeSessionCode) {
             GameService.syncCharacter(updatedChar.activeSessionCode, updatedChar);
        }
    }, 1000);
  };

  const handleJoinSession = async (code: string) => {
    if (!character || !id) return;
    try {
        await GameService.joinGame(code, character);
        // Persist connection
        await CharacterService.update(id, { activeSessionCode: code });
        setShowJoinModal(false);
        showToast(`Connected to ${code}`, 'success');
    } catch (err) {
        console.error(err);
        showToast("Failed to join. Check code.", 'error');
    }
  };

  const handleDisconnect = async () => {
      if (!id) return;
      await CharacterService.update(id, { activeSessionCode: "" });
      setShowJoinModal(false);
      showToast("Disconnected", 'info');
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
    <div className="bg-gray-50 h-[100dvh] flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden relative">
        
        {character.currentHP <= 0 && (
            <DeathScreen character={character} onUpdate={handleUpdate} />
        )}

        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-30 shadow-sm">
            <button 
                onClick={() => navigate('/')}
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
                className={`p-2 rounded-full ${character.activeSessionCode ? 'text-green-500 bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
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
                  {character.activeSessionCode ? (
                       <>
                        <h3 className="font-bold text-lg mb-4 text-center">Connected</h3>
                        <div className="mb-6 text-center">
                            <p className="text-gray-500 mb-2">Current Session</p>
                            <p className="text-4xl font-black font-mono tracking-widest text-slayer-orange">
                                {character.activeSessionCode}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setShowJoinModal(false)}
                                className="flex-1 py-3 font-bold text-gray-500 bg-gray-100 rounded-xl"
                            >
                                Close
                            </button>
                            <button 
                                onClick={handleDisconnect}
                                className="flex-1 py-3 font-bold text-white bg-red-500 rounded-xl shadow-lg shadow-red-200"
                            >
                                Disconnect
                            </button>
                        </div>
                       </>
                  ) : (
                      <>
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
                      </>
                  )}
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
