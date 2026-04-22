import { useState, useEffect, useRef } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { CharacterService } from "../services/characterService";
import { CampaignService } from "../services/campaignService";
import type { Campaign, DiceRollLog, RPGCharacter } from "../types";
import type { GameSession } from "../services/gameService";
import { MainStatsTab } from "./tabs/MainStatsTab";
import { CombatTab } from "./tabs/CombatTab";
import { InventoryTab } from "./tabs/InventoryTab";
import { BioTab } from "./tabs/BioTab";
import { RollsLogTab } from "./tabs/RollsLogTab";
import { DeathScreen } from "../components/DeathScreen";
import { LevelProgressionModal } from "../components/LevelProgressionModal";
import { Shield, Swords, Backpack, Book, ChevronLeft, Loader2, Wifi, ScrollText, Dice6, X, Plus, Minus, ArrowUp, Heart } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { GameService } from "../services/gameService";
import { useToast } from "../context/ToastContext";
import { DiceRollerOverlay } from "../components/DiceRollerOverlay";
import { HealthPopup } from "../components/HealthPopup";
import { Calculator } from "../services/rules";

type TabId = 'stats' | 'combat' | 'inventory' | 'bio' | 'logs';

export function CharacterSheet() {
  const { id } = useParams();
  const navigate = useNavigate();
    const location = useLocation();
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
        const [showFreeRollModal, setShowFreeRollModal] = useState(false);
        const [freeRollPurpose, setFreeRollPurpose] = useState("");
        const [freeRollCount, setFreeRollCount] = useState(1);
        const [freeRollFace, setFreeRollFace] = useState(20);
        const [activeFreeRoll, setActiveFreeRoll] = useState<{ label: string; count: number; face: number } | null>(null);
          const [showLevelModal, setShowLevelModal] = useState(false);
          const [levelModalMode, setLevelModalMode] = useState<"preview" | "level-up">("preview");
                    const [showHealth, setShowHealth] = useState(false);
                    const [activeHealthRoll, setActiveHealthRoll] = useState<{
                            label: string;
                            modifier: number;
                            diceCount: number;
                            diceFace: number;
                    } | null>(null);
                        const [showInitiativePrompt, setShowInitiativePrompt] = useState(false);
                        const [activeInitiativeRoll, setActiveInitiativeRoll] = useState<{ modifier: number } | null>(null);
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCharacterRef = useRef<RPGCharacter | null>(null);
    const lastLevelSeenRef = useRef<number | null>(null);
      const levelPopupHandledRef = useRef<number | null>(null);

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
    if (prev && user?.uid === character.userId) {
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
    }, [character, showToast, user?.uid]);

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
        if (!character) return;
        const pendingLevelPoints = character.unspentLevelPoints ?? 0;
        const levelChanged = lastLevelSeenRef.current !== null && lastLevelSeenRef.current !== character.level;
        lastLevelSeenRef.current = character.level;

        if (!levelChanged && pendingLevelPoints <= 0) return;
        if (levelPopupHandledRef.current === character.level) return;
        levelPopupHandledRef.current = character.level;
        setLevelModalMode("level-up");
        setShowLevelModal(true);
    }, [character?.level, character?.unspentLevelPoints]);

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

    useEffect(() => {
        if (!character || !activeSession?.combat || isDM) {
            setShowInitiativePrompt(false);
            return;
        }

        const participant = activeSession.combat.participants.find((p) => p.id === character.id);
        const needsInitiativeRoll = activeSession.combat.phase === 'setup' && !!participant && (participant.initiative || 0) <= 0;
        setShowInitiativePrompt(needsInitiativeRoll);
    }, [activeSession?.combat, character, isDM]);

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

    const appendRollLog = (purpose: string, notation: string, total: number) => {
        if (!character || !id) return;
        const logEntry: DiceRollLog = {
            id: crypto.randomUUID(),
            purpose,
            notation,
            total,
            createdAt: Date.now()
        };
        const currentLogs = character.diceRollLogs || [];
        const updatedLogs = [logEntry, ...currentLogs].slice(0, 200);
        handleUpdate({ diceRollLogs: updatedLogs });
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

  const maxHP = character.customMaxHP ?? Calculator.getMaxHP(character.constitution, character.level);

  const handleHealthSurge = () => {
      if (isReadOnly || character.healingSurges <= 0) return;
      setActiveHealthRoll({
          label: "Healing Surge",
          modifier: Calculator.getModifier(character.constitution),
          diceCount: 1,
          diceFace: 10,
      });
      setShowHealth(false);
  };

    return (
        <div className="bg-gray-50 dark:bg-slate-950 min-h-[100dvh] w-full flex flex-col overflow-hidden relative transition-colors">
        
        {character.currentHP <= 0 && (
            <DeathScreen character={character} onUpdate={handleUpdate} />
        )}

        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700 px-4 md:px-6 lg:px-8 py-3 flex items-center gap-3 sticky top-0 z-30 shadow-sm">
            <button 
                onClick={() => {
                    const fromState = (location.state as { from?: string } | null)?.from;
                    navigate(fromState || '/');
                }}
                className="p-1 -ml-2 rounded-full active:bg-gray-100 dark:active:bg-slate-800 text-gray-500 dark:text-slate-300"
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

        {/* Responsive Sheet Layout */}
        <div className="flex-1 min-h-0 md:grid md:grid-cols-[220px_minmax(0,1fr)]">
            {/* Tablet/Desktop Side Navigation */}
            <aside className="hidden md:flex md:flex-col md:gap-2 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 p-3 lg:p-4">
                <TabButton
                    active={activeTab === 'stats'}
                    onClick={() => setActiveTab('stats')}
                    icon={<Shield size={20} />}
                    label="Stats"
                    desktop
                />
                <TabButton
                    active={activeTab === 'combat'}
                    onClick={() => setActiveTab('combat')}
                    icon={<Swords size={20} />}
                    label="Combat"
                    desktop
                />
                <TabButton
                    active={activeTab === 'inventory'}
                    onClick={() => setActiveTab('inventory')}
                    icon={<Backpack size={20} />}
                    label="Inventory"
                    desktop
                />
                <TabButton
                    active={activeTab === 'bio'}
                    onClick={() => setActiveTab('bio')}
                    icon={<Book size={20} />}
                    label="Bio"
                    desktop
                />
                <TabButton
                    active={activeTab === 'logs'}
                    onClick={() => setActiveTab('logs')}
                    icon={<ScrollText size={20} />}
                    label="Logs"
                    desktop
                />
            </aside>

            {/* Content Area */}
            <main className="min-h-0 overflow-y-auto px-4 md:px-8 lg:px-12 py-4 md:py-6 lg:py-8 custom-scrollbar">
                {activeTab === 'stats' && <MainStatsTab character={character} onUpdate={handleUpdate} readOnly={isReadOnly} onRollLogged={appendRollLog} />}
                {activeTab === 'combat' && <CombatTab character={character} onUpdate={handleUpdate} readOnly={isReadOnly} isDM={isDM} session={activeSession} onRollLogged={appendRollLog} />}
                {activeTab === 'inventory' && <InventoryTab character={character} onUpdate={handleUpdate} readOnly={isReadOnly} />}
                {activeTab === 'bio' && <BioTab character={character} onUpdate={handleUpdate} readOnly={isReadOnly} />}
                {activeTab === 'logs' && <RollsLogTab logs={character.diceRollLogs || []} />}
            </main>
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 px-4 py-2 pb-6 z-30 sticky bottom-0 flex justify-between items-center">
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
            <TabButton 
                active={activeTab === 'logs'} 
                onClick={() => setActiveTab('logs')} 
                icon={<ScrollText size={24} />} 
                label="Logs" 
            />
        </nav>

        {!isReadOnly && (
            <div className="fixed bottom-24 right-4 md:right-8 z-40">
                <button
                    onClick={() => setShowHealth(true)}
                    className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 hover:scale-105 transition active:scale-95"
                >
                    <Heart size={24} fill="currentColor" />
                    <span className="text-[10px] font-bold mt-0.5">{character.currentHP}/{maxHP}</span>
                </button>
            </div>
        )}

        {!isReadOnly && (
            <div className="fixed bottom-64 right-4 md:right-8 z-40">
                <button
                    onClick={() => {
                        setLevelModalMode("preview");
                        setShowLevelModal(true);
                    }}
                    className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-slayer-orange text-white shadow-lg shadow-orange-400/30 hover:scale-105 transition active:scale-95"
                >
                    <ArrowUp size={22} />
                    <span className="text-[10px] font-bold mt-0.5">Lvl</span>
                </button>
            </div>
        )}

        {!isReadOnly && (
            <div className="fixed bottom-24 left-4 md:left-auto md:right-8 md:bottom-44 z-40">
                <button
                    onClick={() => setShowFreeRollModal(true)}
                    className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-gray-900 text-white shadow-lg shadow-black/30 hover:scale-105 transition active:scale-95"
                >
                    <Dice6 size={24} />
                    <span className="text-[10px] font-bold mt-0.5">Roll</span>
                </button>
            </div>
        )}

        {showHealth && (
            <HealthPopup
                currentHP={character.currentHP}
                maxHP={maxHP}
                healingSurges={character.healingSurges}
                onUpdateHP={(hp) => handleUpdate({ currentHP: hp })}
                onUseSurge={handleHealthSurge}
                onClose={() => setShowHealth(false)}
            />
        )}

        {showFreeRollModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-transparent dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg text-gray-900">Free Dice Roll</h3>
                        <button
                            onClick={() => setShowFreeRollModal(false)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={22} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Rolled For</label>
                            <input
                                value={freeRollPurpose}
                                onChange={(e) => setFreeRollPurpose(e.target.value)}
                                placeholder="e.g. Perception check"
                                className="w-full p-3 border border-gray-200 rounded-xl text-sm font-medium"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Dice Count</label>
                                <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-200">
                                    <button
                                        onClick={() => setFreeRollCount((prev) => Math.max(1, prev - 1))}
                                        className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <div className="flex-1 text-center font-mono text-lg font-bold text-gray-900">{freeRollCount}</div>
                                    <button
                                        onClick={() => setFreeRollCount((prev) => Math.min(20, prev + 1))}
                                        className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Dice Type</label>
                                <select
                                    value={freeRollFace}
                                    onChange={(e) => setFreeRollFace(parseInt(e.target.value))}
                                    className="w-full h-[46px] bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 font-bold"
                                >
                                    <option value={2}>d2</option>
                                    <option value={4}>d4</option>
                                    <option value={6}>d6</option>
                                    <option value={8}>d8</option>
                                    <option value={10}>d10</option>
                                    <option value={12}>d12</option>
                                    <option value={20}>d20</option>
                                    <option value={100}>d100</option>
                                </select>
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-3 text-center">
                            <div className="text-xs uppercase font-bold text-gray-400">Ready Roll</div>
                            <div className="text-2xl font-black text-slayer-orange mt-1">{freeRollCount}d{freeRollFace}</div>
                        </div>

                        <button
                            onClick={() => {
                                setShowFreeRollModal(false);
                                setActiveFreeRoll({
                                    label: freeRollPurpose.trim() || "Free Roll",
                                    count: freeRollCount,
                                    face: freeRollFace
                                });
                            }}
                            className="w-full py-3 rounded-xl bg-gray-900 text-white font-bold"
                        >
                            Roll Dice
                        </button>
                    </div>
                </div>
            </div>
        )}

        {activeFreeRoll && (
            <DiceRollerOverlay
                mode="normal"
                modifier={0}
                label={activeFreeRoll.label}
                diceCount={activeFreeRoll.count}
                diceFace={activeFreeRoll.face}
                onComplete={(total) => {
                    if (total !== undefined) {
                        appendRollLog(activeFreeRoll.label, `${activeFreeRoll.count}d${activeFreeRoll.face}`, total);
                    }
                    setActiveFreeRoll(null);
                }}
            />
        )}

        {activeHealthRoll && (
            <DiceRollerOverlay
                mode="normal"
                modifier={activeHealthRoll.modifier}
                label={activeHealthRoll.label}
                diceCount={activeHealthRoll.diceCount}
                diceFace={activeHealthRoll.diceFace}
                onComplete={(total) => {
                    if (total !== undefined) {
                        appendRollLog(activeHealthRoll.label, `${activeHealthRoll.diceCount}d${activeHealthRoll.diceFace}`, total);
                        const healAmount = Math.max(1, total + activeHealthRoll.modifier);
                        const newHP = Math.min(maxHP, character.currentHP + healAmount);
                        handleUpdate({
                            healingSurges: Math.max(0, character.healingSurges - 1),
                            currentHP: newHP,
                        });
                    }
                    setActiveHealthRoll(null);
                }}
            />
        )}

        {showInitiativePrompt && !activeInitiativeRoll && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-transparent dark:border-slate-700 text-center">
                    <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-2">Roll Initiative</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                        Combat started. Roll your initiative and the DM will see your result.
                    </p>
                    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-3 mb-4">
                        <div className="text-xs uppercase font-bold text-gray-400">Initiative Bonus</div>
                        <div className="text-2xl font-black text-slayer-orange mt-1">
                            {(character.customInitiative ?? Calculator.getModifier(character.dexterity)) >= 0 ? '+' : ''}
                            {character.customInitiative ?? Calculator.getModifier(character.dexterity)}
                        </div>
                    </div>
                    <button
                        onClick={() => setActiveInitiativeRoll({ modifier: character.customInitiative ?? Calculator.getModifier(character.dexterity) })}
                        className="w-full py-3 rounded-xl bg-slayer-orange text-white font-bold shadow-lg shadow-orange-200"
                    >
                        Roll Initiative
                    </button>
                </div>
            </div>
        )}

        {activeInitiativeRoll && character.activeSessionCode && character.id && (
            <DiceRollerOverlay
                mode="normal"
                modifier={activeInitiativeRoll.modifier}
                label="Initiative"
                onComplete={async (total) => {
                    if (total !== undefined) {
                        try {
                            await GameService.updateInitiative(character.activeSessionCode!, character.id!, total);
                            appendRollLog("Initiative", "1d20 + INIT", total);
                            showToast(`Initiative submitted: ${total}`, "success");
                            setShowInitiativePrompt(false);
                        } catch (error) {
                            console.error("Failed to submit initiative", error);
                            showToast("Failed to submit initiative", "error");
                        }
                    }
                    setActiveInitiativeRoll(null);
                }}
            />
        )}

        {showLevelModal && (
            <LevelProgressionModal
                character={character}
                mode={levelModalMode}
                onClose={() => setShowLevelModal(false)}
                onApply={(updates) => handleUpdate(updates)}
            />
        )}

                {showJoinModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-transparent dark:border-slate-700">
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

                            <div className="border-t border-gray-100 dark:border-slate-700 pt-4">
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

function TabButton({ active, onClick, icon, label, desktop = false }: any) {
    return (
        <button 
            onClick={onClick}
            className={desktop
                ? `w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors ${active ? 'text-black bg-gray-100 border-gray-200' : 'text-gray-500 border-transparent hover:bg-gray-50 hover:text-gray-700'}`
                : `flex flex-col items-center gap-1 transition-colors ${active ? 'text-black' : 'text-gray-300 hover:text-gray-500'}`
            }
        >
            <div className={`p-1 rounded-xl transition-all ${active ? 'bg-gray-100' : 'bg-transparent'}`}>
                {icon}
            </div>
            <span className={desktop ? 'text-sm font-bold' : 'text-[10px] font-bold'}>{label}</span>
        </button>
    );
}
