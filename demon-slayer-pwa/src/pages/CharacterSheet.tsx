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
        <div className="bg-gray-50 min-h-[100dvh] w-full flex flex-col overflow-hidden relative">
        
        {character.currentHP <= 0 && (
            <DeathScreen character={character} onUpdate={handleUpdate} />
        )}

        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-4 md:px-6 lg:px-8 py-3 flex items-center gap-3 sticky top-0 z-30 shadow-sm">
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
                    className={`p-2 rounded-full ${character.activeSessionCode ? 'text-green-500 bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                >
                    <Wifi size={20} />
                </button>
            )}
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 py-4 md:py-5 lg:py-6 custom-scrollbar">
            <div className="w-full max-w-screen-2xl mx-auto">
                {activeTab === 'stats' && <MainStatsTab character={character} onUpdate={handleUpdate} readOnly={isReadOnly} />}
                {activeTab === 'combat' && <CombatTab character={character} onUpdate={handleUpdate} readOnly={isReadOnly} isDM={isDM} session={activeSession} />}
                {activeTab === 'inventory' && <InventoryTab character={character} onUpdate={handleUpdate} readOnly={isReadOnly} />}
                {activeTab === 'bio' && <BioTab character={character} onUpdate={handleUpdate} readOnly={isReadOnly} />}
            </div>
        </main>

        {/* Bottom Navigation */}
        <nav className="bg-white border-t border-gray-200 px-4 md:px-6 lg:px-8 py-2 pb-6 z-30 sticky bottom-0">
            <div className="w-full max-w-screen-2xl mx-auto flex justify-between items-center">
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
            </div>
        </nav>

                {showJoinModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
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

                            <div className="space-y-2 mb-5">
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
