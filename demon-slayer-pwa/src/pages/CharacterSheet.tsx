import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CharacterService } from "../services/characterService";
import { CampaignService } from "../services/campaignService";
import type { Campaign, RPGCharacter } from "../types";
import type { GameSession } from "../services/gameService";
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
  const [isDM, setIsDM] = useState(false);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
    const [joinCode, setJoinCode] = useState("");
    const [joinedCampaigns, setJoinedCampaigns] = useState<Campaign[]>([]);
    const [campaignLoading, setCampaignLoading] = useState(false);
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCharacterRef = useRef<RPGCharacter | null>(null);

  // Check DM Status
  useEffect(() => {
     const checkDM = async () => {
         if (character?.activeSessionCode && user) {
             const isDm = await GameService.checkIsDM(character.activeSessionCode, user.uid);
             setIsDM(isDm);
         } else {
             setIsDM(false);
         }
     };
     checkDM();
  }, [character?.activeSessionCode, user]);

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

  useEffect(() => {
    if (!character?.activeSessionCode || !id) return;

    const unsubscribe = GameService.subscribeToSession(character.activeSessionCode, async (session) => {
        if (!session) {
            showToast("Session ended by DM", "info");
            await CharacterService.update(id, { activeSessionCode: "" });
            setActiveSession(null);
        } else {
            setActiveSession(session);
        }
    });

    return () => unsubscribe();
  }, [character?.activeSessionCode, id]);

    useEffect(() => {
        if (!showJoinModal) return;
        const memberships = character?.campaigns || [];
        if (memberships.length === 0) {
            setJoinedCampaigns([]);
            setCampaignLoading(false);
            return;
        }

        let isActive = true;
        setCampaignLoading(true);

        Promise.all(memberships.map(membership => CampaignService.getCampaign(membership.id)))
            .then((results) => {
                if (!isActive) return;
                const campaigns = results.filter(Boolean) as Campaign[];
                campaigns.sort((a, b) => a.name.localeCompare(b.name));
                setJoinedCampaigns(campaigns);
            })
            .catch((error) => {
                console.error("Failed to load campaigns", error);
            })
            .finally(() => {
                if (isActive) setCampaignLoading(false);
            });

        return () => {
            isActive = false;
        };
    }, [showJoinModal, character?.campaigns]);

  const isReadOnly = (character && user) 
      ? (user.uid !== character.userId && character.type !== 'demon') 
      : true;

  const handleUpdate = (updates: Partial<RPGCharacter>) => {
    if (!character || !id) return;
    if (isReadOnly && !isDM) return;
    
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

    const handleJoinCampaign = async (code: string) => {
        if (!character || !id) return;
        const normalized = code.trim().toUpperCase();
        if (!normalized) {
            showToast("Enter an invite code", "info");
            return;
        }

        try {
            const campaign = await CampaignService.getByInviteCode(normalized);
            if (!campaign) {
                showToast("Campaign not found", "error");
                return;
            }

            const currentCampaigns = character.campaigns || [];
            if (currentCampaigns.some(existing => existing.id === campaign.id)) {
                showToast("You are already in this campaign", "info");
                setJoinCode("");
                return;
            }

            await CampaignService.addMember(campaign.id, character);
            const updatedCampaigns = [
                ...currentCampaigns,
                { id: campaign.id, name: campaign.name, joinedAt: Date.now() }
            ];
            await CharacterService.update(id, { campaigns: updatedCampaigns });
            setCharacter({ ...character, campaigns: updatedCampaigns });
            setJoinedCampaigns(prev => [...prev, campaign].sort((a, b) => a.name.localeCompare(b.name)));
            setJoinCode("");
            showToast(`Joined ${campaign.name}`, "success");
        } catch (err) {
            console.error(err);
            showToast("Failed to join campaign", "error");
        }
    };

    const handleJoinLiveSession = async (campaign: Campaign) => {
        if (!character || !id) return;
        if (!campaign.activeSessionCode) {
            showToast("No live session for this campaign", "info");
            return;
        }

        try {
            if (character.activeSessionCode && character.activeSessionCode !== campaign.activeSessionCode) {
                await GameService.leaveGame(character.activeSessionCode, id);
            }

            await GameService.joinGame(campaign.activeSessionCode, character);
            await CharacterService.update(id, { activeSessionCode: campaign.activeSessionCode });
            setCharacter({ ...character, activeSessionCode: campaign.activeSessionCode });
            showToast(`Connected to ${campaign.name}`, "success");
        } catch (err) {
            console.error(err);
            showToast("Failed to join live session", "error");
        }
    };

  const handleDisconnect = async () => {
      if (!id) return;
      if (character?.activeSessionCode) {
          await GameService.leaveGame(character.activeSessionCode, id);
      }
      await CharacterService.update(id, { activeSessionCode: "" });
      setCharacter(prev => prev ? { ...prev, activeSessionCode: "" } : prev);
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
        <div className="min-h-[100dvh] bg-gradient-to-br from-gray-100 via-gray-50 to-orange-50/40 text-gray-900">
        
        {character.currentHP <= 0 && (
            <DeathScreen character={character} onUpdate={handleUpdate} />
        )}

        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-white/70 bg-white/90 backdrop-blur px-3 sm:px-4 lg:px-6 py-3 shadow-sm">
            <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
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
            
            {!isReadOnly && (
                <button 
                    onClick={() => setShowJoinModal(true)}
                    className={`ml-auto p-2 rounded-full ${character.activeSessionCode ? 'text-green-500 bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                >
                    <Wifi size={20} />
                </button>
            )}
            </div>
        </header>

        {/* Content Area */}
        <main className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-3 sm:p-4 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-5 md:p-5 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-6 lg:p-6 custom-scrollbar">
            <aside className="hidden md:flex flex-col gap-4 self-start sticky top-24">
                <section className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-lg shadow-gray-200/40 backdrop-blur">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-slayer-orange to-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-200">
                            <Shield size={28} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Character</div>
                            <h2 className="truncate text-xl font-black text-gray-900">{character.name}</h2>
                            <p className="truncate text-sm text-gray-500">Lv.{character.level} {character.characterClass}</p>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl bg-gray-50 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">HP</div>
                            <div className="mt-1 text-lg font-black">{character.currentHP}/{character.maxHP}</div>
                        </div>
                        <div className="rounded-2xl bg-gray-50 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Session</div>
                            <div className="mt-1 text-lg font-black">{character.activeSessionCode || 'Idle'}</div>
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-white/70 bg-white/90 p-3 shadow-lg shadow-gray-200/40 backdrop-blur">
                    <div className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">Tabs</div>
                    <div className="flex flex-col gap-2">
                        <DesktopTabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<Shield size={18} />} label="Stats" />
                        <DesktopTabButton active={activeTab === 'combat'} onClick={() => setActiveTab('combat')} icon={<Swords size={18} />} label="Combat" />
                        <DesktopTabButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Backpack size={18} />} label="Bag" />
                        <DesktopTabButton active={activeTab === 'bio'} onClick={() => setActiveTab('bio')} icon={<Book size={18} />} label="Bio" />
                    </div>
                </section>
            </aside>

            <section className="min-w-0 rounded-2xl md:rounded-3xl border border-white/70 bg-white/95 shadow-xl md:shadow-2xl shadow-gray-200/40 backdrop-blur overflow-hidden">
                <div className="md:hidden border-b border-gray-100 px-3 pt-2">
                    <div className="grid grid-cols-4 gap-1 rounded-2xl bg-gray-100 p-1">
                        <CompactTabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<Shield size={18} />} label="Stats" />
                        <CompactTabButton active={activeTab === 'combat'} onClick={() => setActiveTab('combat')} icon={<Swords size={18} />} label="Combat" />
                        <CompactTabButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Backpack size={18} />} label="Bag" />
                        <CompactTabButton active={activeTab === 'bio'} onClick={() => setActiveTab('bio')} icon={<Book size={18} />} label="Bio" />
                    </div>
                </div>

                <div className="overflow-y-auto p-3 sm:p-4 md:p-5 lg:p-6 custom-scrollbar">
                    {activeTab === 'stats' && <MainStatsTab character={character} onUpdate={handleUpdate} readOnly={isReadOnly} />}
                    {activeTab === 'combat' && <CombatTab character={character} onUpdate={handleUpdate} readOnly={isReadOnly} isDM={isDM} session={activeSession} />}
                    {activeTab === 'inventory' && <InventoryTab character={character} onUpdate={handleUpdate} readOnly={isReadOnly} />}
                    {activeTab === 'bio' && <BioTab character={character} onUpdate={handleUpdate} readOnly={isReadOnly} />}
                </div>
            </section>
        </main>

        {/* Bottom Navigation */}
        <nav className="md:hidden bg-white border-t border-gray-200 px-2 sm:px-4 py-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 flex justify-between items-center gap-1 sm:gap-2 z-30 sticky bottom-0">
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-full sm:max-w-sm lg:max-w-md shadow-2xl">
                            <h3 className="font-bold text-lg mb-4">Campaigns</h3>

                            {character.activeSessionCode && (
                                <div className="mb-4 rounded-xl border border-green-100 bg-green-50 p-3">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-green-700">Connected</div>
                                    <div className="font-mono text-lg font-bold text-green-600">
                                        {character.activeSessionCode}
                                    </div>
                                    <button
                                        onClick={handleDisconnect}
                                        className="mt-3 w-full py-2 font-bold text-white bg-red-500 rounded-lg shadow-lg shadow-red-200"
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            )}

                                <div className="space-y-2 mb-5 max-h-[45vh] overflow-y-auto pr-1">
                                {campaignLoading ? (
                                    <div className="text-sm text-gray-400">Loading campaigns...</div>
                                ) : joinedCampaigns.length === 0 ? (
                                    <div className="text-sm text-gray-400">No joined campaigns yet.</div>
                                ) : (
                                    joinedCampaigns.map((campaign) => (
                                        <div key={campaign.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3">
                                            <div>
                                                <div className="font-bold text-gray-900">{campaign.name}</div>
                                                <div className="text-xs text-gray-400">
                                                    {campaign.activeSessionCode ? "Live session available" : "Waiting for DM"}
                                                </div>
                                            </div>
                                            {campaign.activeSessionCode ? (
                                                character.activeSessionCode === campaign.activeSessionCode ? (
                                                    <span className="text-xs font-bold text-green-600">Connected</span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleJoinLiveSession(campaign)}
                                                        className="px-3 py-2 text-xs font-bold text-white bg-slayer-orange rounded-lg"
                                                    >
                                                        Join Live
                                                    </button>
                                                )
                                            ) : (
                                                <span className="text-xs font-bold text-gray-400">Offline</span>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="border-t border-gray-100 pt-4">
                                <h4 className="text-sm font-bold mb-2">Join Campaign</h4>
                                <input
                                    autoFocus
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                    placeholder="Enter Invite Code (e.g. A1B2C3)"
                                    className="w-full p-3 border border-gray-300 rounded-xl mb-4 text-center font-mono uppercase text-lg font-bold tracking-widest"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleJoinCampaign(joinCode);
                                        }
                                    }}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setShowJoinModal(false);
                                            setJoinCode("");
                                        }}
                                        className="flex-1 py-3 font-bold text-gray-500 bg-gray-100 rounded-xl"
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={() => handleJoinCampaign(joinCode)}
                                        className="flex-1 py-3 font-bold text-white bg-slayer-orange rounded-xl shadow-lg shadow-orange-200"
                                    >
                                        Join
                                    </button>
                                </div>
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

function DesktopTabButton({ active, onClick, icon, label }: any) {
    return (
        <button
            onClick={onClick}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all ${active ? 'bg-gray-900 text-white shadow-lg shadow-gray-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
        >
            <div className={`rounded-xl p-2 ${active ? 'bg-white/10' : 'bg-white'}`}>
                {icon}
            </div>
            <span className="text-sm font-bold">{label}</span>
        </button>
    );
}

function CompactTabButton({ active, onClick, icon, label }: any) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-bold transition-all ${active ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}
