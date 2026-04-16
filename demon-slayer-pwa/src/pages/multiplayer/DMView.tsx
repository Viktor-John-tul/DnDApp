import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { GameService } from "../../services/gameService";
import { CampaignService } from "../../services/campaignService";
import { CharacterService } from "../../services/characterService";
import type { GameSession } from "../../services/gameService";
import type { Campaign, StatusEffect, InventoryItem } from "../../types";
import { Copy, Users, Power, ArrowLeft, Sparkles, Backpack, FileText, Coins, X, Heart, Wind, Square, CheckSquare, Swords, Lock, Crosshair } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import { CombatManager } from "../../components/CombatManager";

const COMMON_EFFECTS = [
    { name: "Advantage", type: "advantage" },
    { name: "Disadvantage", type: "disadvantage" },
    { name: "Poisoned", type: "condition" },
    { name: "Stunned", type: "condition" },
    { name: "Restrained", type: "condition" },
    { name: "Unconscious", type: "condition" },
    { name: "Blinded", type: "condition" },
];

export function DMView() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const navigate = useNavigate();
    const { campaignId } = useParams();
    const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
    const [startingSession, setStartingSession] = useState(false);

  // DM Tools State
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [targetIds, setTargetIds] = useState<Set<string>>(new Set());
  const [applyingEffect, setApplyingEffect] = useState(false);
  const [activeTool, setActiveTool] = useState<'effects' | 'items' | 'gold' | 'notes' | 'health' | 'actions' | 'forms' | 'combat'>('combat');

  // Action Adding State
  const [newActionParams, setNewActionParams] = useState({ name: "", description: "", type: "main" as 'main' | 'bonus' | 'reaction' | 'free' });

  // Item Adding State
  const [newItemParams, setNewItemParams] = useState({ name: "", quantity: 1, weight: 0 });
  const [goldAmount, setGoldAmount] = useState(0);
  const [hpAmount, setHpAmount] = useState(0);
  
  // Note Editing State
  const [dmNoteBuffer, setDmNoteBuffer] = useState("");
  const [showNoteEditor, setShowNoteEditor] = useState(false);

    // Load Campaign
    useEffect(() => {
        if (!campaignId || !user) return;

        const unsubscribe = CampaignService.subscribeToCampaign(campaignId, (data) => {
            if (!data) {
                showToast("Campaign not found", "error");
                navigate("/dm");
                return;
            }

            if (data.dmId !== user.uid) {
                showToast("You do not have access to this campaign", "error");
                navigate("/dm");
                return;
            }

            setCampaign(data);
            setSessionCode(data.activeSessionCode || null);
        });

        return () => unsubscribe();
    }, [campaignId, navigate, showToast, user]);

  // Subscribe to Session
  useEffect(() => {
        if (!sessionCode) {
            setSession(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = GameService.subscribeToSession(sessionCode, (data) => {
            if (!data) {
                // Session was deleted remotely
                setSessionCode(null);
                setSession(null);
                setLoading(false);
                if (campaignId) {
                    CampaignService.setActiveSessionCode(campaignId, "");
                }
                return;
            }
            setSession(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [campaignId, sessionCode]);

  const handleEndSession = async () => {
      if (!sessionCode) return;
      const isConfirmed = await confirm({
        title: "End Session?",
        message: "Are you sure you want to end this session? All players will be disconnected.",
        confirmText: "End Session",
        variant: "danger"
      });

      if (!isConfirmed) return;
      
      try {
          await GameService.endSession(sessionCode);
                    if (campaignId) {
                        await CampaignService.setActiveSessionCode(campaignId, "");
                    }
          setSessionCode(null);
                    navigate("/dm");
      } catch (err) {
          console.error(err);
      }
  };

    const handleStartSession = async () => {
        if (!user || !campaignId) return;
        setStartingSession(true);
        try {
            const code = await GameService.createGame(user.uid);
            await CampaignService.setActiveSessionCode(campaignId, code);
            setSessionCode(code);
        } catch (error) {
            console.error("Failed to start session", error);
            showToast("Failed to start session", "error");
        } finally {
            setStartingSession(false);
        }
    };

  const handleApplyEffect = async () => {
      if (!selectedEffect || targetIds.size === 0) return;
      setApplyingEffect(true);

      const template = COMMON_EFFECTS.find(e => e.name === selectedEffect);
      if (!template) return;

      try {
          const promises = Array.from(targetIds).map(async (charId) => {
              const char = await CharacterService.get(charId);
              if (!char) return;

              const newEffect: StatusEffect = {
                  id: crypto.randomUUID(),
                  name: template.name,
                  type: template.type as any
              };
              
              const currentEffects = char.statusEffects || [];
              await CharacterService.update(charId, { statusEffects: [...currentEffects, newEffect] });
          });

          await Promise.all(promises);
          showToast(`Applied ${selectedEffect} to ${targetIds.size} players.`, 'success');
          setTargetIds(new Set()); // Clear selection
          setSelectedEffect(null);
      } catch (error) {
          console.error("Failed to apply effects", error);
          showToast("Error applying effects", 'error');
      } finally {
          setApplyingEffect(false);
      }
  };

  const handleGiveItem = async () => {
      if (!newItemParams.name || targetIds.size === 0) return;
      
      const isConfirmed = await confirm({
          title: "Give Item to Players",
          message: `Give "${newItemParams.name}" (x${newItemParams.quantity}) to ${targetIds.size} player(s)?`,
          confirmText: "Give Item",
          variant: "info"
      });
      if (!isConfirmed) return;

      try {
          const promises = Array.from(targetIds).map(async (charId) => {
              const char = await CharacterService.get(charId);
              if (!char) return;

              const newItem: InventoryItem = {
                  id: crypto.randomUUID(),
                  name: newItemParams.name,
                  description: "Given by DM",
                  quantity: newItemParams.quantity,
                  weight: newItemParams.weight
              };
              
              const currentInv = char.inventory || [];
              await CharacterService.update(charId, { inventory: [...currentInv, newItem] });
          });

          await Promise.all(promises);
          showToast(`Given ${newItemParams.name} to ${targetIds.size} players.`, 'success');
          setNewItemParams({ name: "", quantity: 1, weight: 0 });
          setTargetIds(new Set()); 
      } catch (error) {
          showToast("Error giving items", 'error');
      }
  };

  const handleGiveGold = async () => {
    if (!goldAmount || targetIds.size === 0) return;

    const isConfirmed = await confirm({
        title: "Give Gold",
        message: `Give ${goldAmount} Gold to ${targetIds.size} player(s)?`,
        confirmText: "Give Gold",
        variant: "info"
    });
    if (!isConfirmed) return;

    try {
        const promises = Array.from(targetIds).map(async (charId) => {
            const char = await CharacterService.get(charId);
            if (!char) return;

            const currentGold = char.gold || 0;
            // Allow negative values to take gold away
            await CharacterService.update(charId, { gold: Math.max(0, currentGold + goldAmount) });
        });

        await Promise.all(promises);
        showToast(`Transferred ${goldAmount} Gold to ${targetIds.size} players.`, 'success');
        setGoldAmount(0);
        setTargetIds(new Set());
    } catch (error) {
        showToast("Error transferring gold", 'error');
    }
  };

  const handleUpdateDMNotes = async () => {
      if (targetIds.size !== 1) return;
      const charId = Array.from(targetIds)[0];
      
      try {
          await CharacterService.update(charId, { dmNotes: dmNoteBuffer });
          showToast("DM Notes updated", 'success');
          setShowNoteEditor(false);
          setTargetIds(new Set());
      } catch (error) {
          showToast("Error updating notes", 'error');
      }
  };

  const handleAddAction = async () => {
      if (!newActionParams.name || targetIds.size === 0) return;

      const isConfirmed = await confirm({
          title: "Add Action",
          message: `Add action "${newActionParams.name}" to ${targetIds.size} player(s)?`,
          confirmText: "Add Action",
          variant: "info"
      });
      if (!isConfirmed) return;

      try {
          const promises = Array.from(targetIds).map(async (charId) => {
              const char = await CharacterService.get(charId);
              if (!char) return;

              const newAction = {
                  id: crypto.randomUUID(),
                  ...newActionParams
              };
              
              const currentActions = char.customActions || [];
              await CharacterService.update(charId, { customActions: [...currentActions, newAction] });
          });

          await Promise.all(promises);
          showToast(`Added action to ${targetIds.size} players.`, 'success');
          setNewActionParams({ name: "", description: "", type: "main" });
          setTargetIds(new Set());
      } catch (error) {
          showToast("Error adding action", 'error');
      }
  };

  const handleLockForms = async (shouldLock: boolean) => {
      if (targetIds.size === 0) return;

      const isConfirmed = await confirm({
          title: shouldLock ? "Lock Forms" : "Unlock Forms",
          message: `${shouldLock ? 'Lock' : 'Unlock'} breathing forms for ${targetIds.size} player(s)?`,
          confirmText: shouldLock ? "Lock Forms" : "Unlock Forms",
          variant: shouldLock ? "danger" : "info"
      });
      if (!isConfirmed) return;

      try {
          const promises = Array.from(targetIds).map(async (charId) => {
              const char = await CharacterService.get(charId);
              if (!char) return;
              
              const updatedForms = char.breathingForms.map(form => ({
                  ...form,
                  isLocked: shouldLock
              }));

              await CharacterService.update(charId, { breathingForms: updatedForms });
          });

          await Promise.all(promises);
          showToast(`Forms ${shouldLock ? 'locked' : 'unlocked'} for ${targetIds.size} players.`, 'success');
          setTargetIds(new Set());
      } catch (error) {
          showToast("Error updating form locks", 'error');
      }
  };

  const handleModifyHP = async (multiplier: number) => {
      if (!hpAmount || targetIds.size === 0) return;
      
      const isHealing = multiplier > 0;
      const isConfirmed = await confirm({
          title: isHealing ? "Heal Players" : "Deal Damage",
          message: `${isHealing ? 'Heal' : 'Deal'} ${Math.abs(hpAmount)} HP to ${targetIds.size} player(s)?`,
          confirmText: isHealing ? "Heal" : "Deal Damage",
          variant: isHealing ? "success" : "danger"
      });
      if (!isConfirmed) return;

      try {
          const promises = Array.from(targetIds).map(async (charId) => {
              const char = await CharacterService.get(charId);
              if (!char) return;

              let newHP = char.currentHP + (hpAmount * multiplier);
              newHP = Math.max(0, Math.min(newHP, char.maxHP));
              
              const updatedChar = { ...char, currentHP: newHP };
              
              await CharacterService.update(charId, { currentHP: newHP });
              if (sessionCode) {
                  await GameService.syncCharacter(sessionCode, updatedChar);
              }
          });

          await Promise.all(promises);
          showToast(`Applied ${isHealing ? 'Healing' : 'Damage'} to ${targetIds.size} players.`, 'success');
          setHpAmount(0);
          setTargetIds(new Set());
      } catch (error) {
          showToast("Error updating HP", 'error');
      }
  };

  const openNoteEditor = async () => {
    if (targetIds.size !== 1) {
        showToast("Select exactly one player to edit notes", 'info');
        return;
    }
    const charId = Array.from(targetIds)[0];
    const char = await CharacterService.get(charId);
    if(char) {
        setDmNoteBuffer(char.dmNotes || "");
        setShowNoteEditor(true);
    }
  };

  const toggleTarget = (id: string) => {
      const newSet = new Set(targetIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setTargetIds(newSet);
  };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-center">
                        <div className="animate-spin w-8 h-8 border-4 border-slayer-orange border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-gray-500 font-bold">Accessing Session...</p>
                </div>
            </div>
        );
    }

    if (!sessionCode) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-gray-200 text-center">
                    <p className="text-gray-500 font-bold mb-2">No Active Session</p>
                    <p className="text-gray-400 text-sm mb-5">
                        {campaign?.name || "This campaign"} is idle.
                    </p>
                    <button
                        onClick={handleStartSession}
                        disabled={startingSession}
                        className="w-full py-3 font-bold text-white bg-slayer-orange rounded-xl shadow-lg shadow-orange-200 disabled:opacity-60"
                    >
                        Start Session
                    </button>
                    <Link
                        to="/dm"
                        className="mt-3 inline-block text-sm font-bold text-gray-500"
                    >
                        Back to Campaigns
                    </Link>
                </div>
            </div>
        );
    }

  const players = Object.values(session?.players || {});

  return (
    <div className="min-h-screen bg-gray-100 p-3 sm:p-4 pb-24 md:pb-10">
            {/* Header / HUD */}
            <div className="bg-gray-900 text-white p-3 sm:p-4 rounded-xl shadow-lg mb-5 sm:mb-6 sticky top-2 z-10">
                <div className="flex justify-between items-start sm:items-center gap-3 mb-2">
                    <div className="flex items-center gap-2">
                        <Link to="/dm" className="text-gray-400 hover:text-white"><ArrowLeft size={20}/></Link>
                        <div>
                            <h1 className="font-bold text-lg leading-tight">DM Overwatch</h1>
                            {campaign?.name && (
                                <p className="text-xs text-gray-400">{campaign.name}</p>
                            )}
                        </div>
                    </div>
              
              <button 
                onClick={handleEndSession}
                className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs font-bold border border-red-900 bg-red-900/20 px-2 py-1 rounded"
              >
                  <Power size={12} /> END
              </button>
          </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                        <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 w-full sm:w-auto overflow-hidden">
                  <span className="text-xs text-gray-400 uppercase tracking-widest">Join Code</span>
                  <span className="font-mono font-bold text-slayer-orange text-lg tracking-wider">{sessionCode}</span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(sessionCode)}
                    className="ml-2 text-gray-500 hover:text-white"
                  >
                      <Copy size={14} />
                  </button>
            </div>
            <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Users size={16} />
                <span>{players.length} Players</span>
            </div>
          </div>
       </div>

       {/* DM Tools Container */}
       <div className="bg-white rounded-2xl shadow-xl border border-gray-200 mb-8 overflow-hidden">
           {/* Tool Tabs */}
           <div className="flex border-b border-gray-100 overflow-x-auto">
               <ToolTab 
                  active={activeTool === 'combat'} 
                  onClick={() => setActiveTool('combat')} 
                  icon={<Crosshair size={18}/>} 
                  label="Combat"
                  color="text-red-600" 
                />
               <ToolTab 
                  active={activeTool === 'effects'} 
                  onClick={() => setActiveTool('effects')} 
                  icon={<Sparkles size={18}/>} 
                  label="Effects"
                  color="text-slayer-orange" 
                />
               <ToolTab 
                  active={activeTool === 'health'} 
                  onClick={() => setActiveTool('health')} 
                  icon={<Heart size={18}/>} 
                  label="Health"
                  color="text-red-500" 
                />
               <ToolTab 
                  active={activeTool === 'items'} 
                  onClick={() => setActiveTool('items')} 
                  icon={<Backpack size={18}/>} 
                  label="Items"
                  color="text-blue-500" 
                />
               <ToolTab 
                  active={activeTool === 'actions'} 
                  onClick={() => setActiveTool('actions')} 
                  icon={<Swords size={18}/>} 
                  label="Actions"
                  color="text-indigo-500" 
                />
               <ToolTab 
                  active={activeTool === 'forms'} 
                  onClick={() => setActiveTool('forms')} 
                  icon={<Lock size={18}/>} 
                  label="Forms"
                  color="text-gray-600" 
                />
               <ToolTab 
                  active={activeTool === 'gold'} 
                  onClick={() => setActiveTool('gold')} 
                  icon={<Coins size={18}/>} 
                  label="Gold"
                  color="text-yellow-500" 
                />
               <ToolTab 
                  active={activeTool === 'notes'} 
                  onClick={() => setActiveTool('notes')} 
                  icon={<FileText size={18}/>} 
                  label="Notes"
                  color="text-purple-500" 
                />
           </div>

           {/* Tool Content */}
           <div className="p-4 sm:p-6 bg-gray-50/50 min-h-[300px]">
               <AnimatePresence mode="wait">
                   {activeTool === 'combat' && sessionCode && session && (
                       <motion.div 
                         key="combat"
                         initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                       >
                           <CombatManager session={session} sessionCode={sessionCode} />
                       </motion.div>
                   )}
                   
                   {activeTool === 'effects' && (
                       <motion.div 
                         key="effects"
                         initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                         className="space-y-4"
                       >
                           <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Select Effect</h3>
                           <div className="flex flex-wrap gap-2">
                               {COMMON_EFFECTS.map(effect => (
                                   <button
                                       key={effect.name}
                                       onClick={() => setSelectedEffect(effect.name)}
                                       className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                                           selectedEffect === effect.name 
                                           ? 'bg-slayer-orange text-white border-slayer-orange ring-2 ring-orange-200' 
                                           : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 shadow-sm'
                                       }`}
                                   >
                                       {effect.name}
                                   </button>
                               ))}
                           </div>
                           
                           <div className="pt-4 mt-4 border-t border-gray-200">
                                <button 
                                    onClick={handleApplyEffect}
                                    disabled={!selectedEffect || targetIds.size === 0 || applyingEffect}
                                    className="w-full bg-slayer-orange text-white font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-orange-100 flex items-center justify-center gap-2"
                                >
                                    {applyingEffect ? 'Applying...' : (
                                        <>
                                            Apply {selectedEffect || 'Effect'} 
                                            <span className="bg-white/20 px-2 py-0.5 rounded text-xs">
                                                {targetIds.size} Players
                                            </span>
                                        </>
                                    )}
                                </button>
                           </div>
                       </motion.div>
                   )}

                   {activeTool === 'health' && (
                       <motion.div 
                         key="health"
                         initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                         className="space-y-4"
                       >
                           <div className="text-center py-6">
                               <Heart size={48} className="mx-auto text-red-200 mb-4 animate-pulse" />
                               <input 
                                   type="number" 
                                   placeholder="0"
                                   min="0"
                                   value={hpAmount === 0 ? '' : hpAmount}
                                   onChange={e => setHpAmount(Math.abs(parseInt(e.target.value)))}
                                   className="w-full max-w-[200px] text-center text-5xl font-black bg-transparent border-b-2 border-gray-200 focus:border-red-400 outline-none p-2 text-gray-800 placeholder-gray-300 mx-auto block"
                               />
                               <p className="text-gray-400 text-sm mt-2 font-bold uppercase tracking-widest">Hit Points</p>
                           </div>
                           
                           <div className="grid grid-cols-2 gap-4">
                               <button 
                                    onClick={() => handleModifyHP(-1)}
                                    disabled={targetIds.size === 0 || !hpAmount}
                                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-red-200 flex flex-col items-center justify-center gap-1"
                                >
                                    <span className="text-xl">Damage</span>
                                    <span className="text-xs opacity-75">(-{hpAmount} HP)</span>
                                </button>
                                <button 
                                    onClick={() => handleModifyHP(1)}
                                    disabled={targetIds.size === 0 || !hpAmount}
                                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-green-200 flex flex-col items-center justify-center gap-1"
                                >
                                    <span className="text-xl">Heal</span>
                                    <span className="text-xs opacity-75">(+{hpAmount} HP)</span>
                                </button>
                           </div>
                       </motion.div>
                   )}

                   {activeTool === 'items' && (
                       <motion.div 
                         key="items"
                         initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                         className="space-y-4"
                       >
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Item Details</h3>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                                <input 
                                    type="text" 
                                    placeholder="Item Name"
                                    value={newItemParams.name}
                                    onChange={e => setNewItemParams({...newItemParams, name: e.target.value})}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg font-medium outline-none focus:ring-2 ring-blue-100 transition-all"
                                />
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Quantity</label>
                                        <input 
                                            type="number" 
                                            value={newItemParams.quantity}
                                            onChange={e => setNewItemParams({...newItemParams, quantity: Math.max(1, parseInt(e.target.value)||1)})}
                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg font-medium text-center outline-none focus:ring-2 ring-blue-100"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Weight</label>
                                        <input 
                                            type="number" 
                                            value={newItemParams.weight}
                                            onChange={e => setNewItemParams({...newItemParams, weight: parseFloat(e.target.value)||0})}
                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg font-medium text-center outline-none focus:ring-2 ring-blue-100"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={handleGiveItem}
                                disabled={targetIds.size === 0 || !newItemParams.name}
                                className="w-full bg-blue-500 text-white font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                            >
                                <Backpack size={20} />
                                Give to {targetIds.size} Players
                            </button>
                       </motion.div>
                   )}

                   {activeTool === 'actions' && (
                       <motion.div 
                         key="actions"
                         initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                         className="space-y-4"
                       >
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">New Action Details</h3>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                                <input 
                                    type="text" 
                                    placeholder="Action Name"
                                    value={newActionParams.name}
                                    onChange={e => setNewActionParams({...newActionParams, name: e.target.value})}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg font-medium outline-none focus:ring-2 ring-indigo-100 transition-all"
                                />
                                <input 
                                    type="text" 
                                    placeholder="Description (optional)"
                                    value={newActionParams.description}
                                    onChange={e => setNewActionParams({...newActionParams, description: e.target.value})}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 ring-indigo-100 transition-all"
                                />
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Action Type</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {(['main', 'bonus', 'reaction', 'free'] as const).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setNewActionParams({...newActionParams, type})}
                                                className={`p-2 text-xs font-bold uppercase rounded-lg border ${
                                                    newActionParams.type === type
                                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600 ring-1 ring-indigo-200'
                                                    : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
                                                }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={handleAddAction}
                                disabled={targetIds.size === 0 || !newActionParams.name}
                                className="w-full bg-indigo-500 text-white font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                            >
                                <Swords size={20} />
                                Add Action to {targetIds.size} Players
                            </button>
                       </motion.div>
                   )}

                   {activeTool === 'forms' && (
                       <motion.div 
                         key="forms"
                         initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                         className="space-y-4"
                       >
                           <div className="text-center py-6">
                               <Lock size={48} className="mx-auto text-gray-300 mb-4" />
                               <h3 className="font-bold text-gray-700 text-lg mb-2">Form Management</h3>
                               <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
                                   Lock player breathing forms to prevent editing during combat.
                               </p>
                           </div>
                           
                           <div className="grid grid-cols-2 gap-4">
                               <button 
                                    onClick={() => handleLockForms(true)}
                                    disabled={targetIds.size === 0}
                                    className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-gray-200 flex flex-col items-center justify-center gap-1"
                                >
                                    <span className="text-xl flex items-center gap-2"><Lock size={18}/> Lock</span>
                                    <span className="text-xs opacity-75">All Forms</span>
                                </button>
                                <button 
                                    onClick={() => handleLockForms(false)}
                                    disabled={targetIds.size === 0}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-gray-100 flex flex-col items-center justify-center gap-1"
                                >
                                    <span className="text-xl flex items-center gap-2"><Lock size={18} className="opacity-50"/> Unlock</span>
                                    <span className="text-xs opacity-75">All Forms</span>
                                </button>
                           </div>
                       </motion.div>
                   )}

                   {activeTool === 'gold' && (
                       <motion.div 
                         key="gold"
                         initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                         className="space-y-4"
                       >
                           <div className="text-center py-6">
                               <div className="text-6xl font-black text-gray-200 mb-4 select-none">GP</div>
                               <input 
                                   type="number" 
                                   placeholder="0"
                                   value={goldAmount === 0 ? '' : goldAmount}
                                   onChange={e => setGoldAmount(parseInt(e.target.value))}
                                   className="w-full max-w-[200px] text-center text-4xl font-bold bg-transparent border-b-2 border-gray-200 focus:border-yellow-400 outline-none p-2 text-gray-800 placeholder-gray-300 mx-auto block"
                               />
                               <p className="text-gray-400 text-sm mt-2">Use negative values to remove gold</p>
                           </div>
                           
                           <button 
                                onClick={handleGiveGold}
                                disabled={targetIds.size === 0 || !goldAmount}
                                className="w-full bg-yellow-500 text-white font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-yellow-100 flex items-center justify-center gap-2"
                            >
                                <Coins size={20} />
                                Transfer to {targetIds.size} Players
                            </button>
                       </motion.div>
                   )}

                   {activeTool === 'notes' && (
                       <motion.div 
                         key="notes"
                         initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                         className="space-y-4"
                       >
                           <div className="bg-purple-50 rounded-xl p-8 text-center border border-purple-100">
                               <FileText size={48} className="mx-auto text-purple-200 mb-4" />
                               <h3 className="font-bold text-purple-900 text-lg mb-2">Private DM Notes</h3>
                               <p className="text-purple-700/60 text-sm mb-6 max-w-xs mx-auto">
                                   Select a single player below to view and edit their private session notes.
                               </p>
                               <button 
                                    onClick={openNoteEditor}
                                    disabled={targetIds.size !== 1}
                                    className="bg-purple-500 text-white font-bold py-3 px-8 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-purple-200"
                               >
                                   {targetIds.size === 1 ? "Open Note Editor" : "Select 1 Player"}
                               </button>
                           </div>
                       </motion.div>
                   )}
               </AnimatePresence>
           </div>
       </div>
       
       {showNoteEditor && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl animate-fade-in-up">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                             <FileText size={20} className="text-purple-500"/>
                             Edit DM Notes
                        </h3>
                        <button onClick={() => setShowNoteEditor(false)} className="text-gray-400 hover:text-gray-600">
                             <X size={20} />
                        </button>
                    </div>
                    <textarea 
                        value={dmNoteBuffer}
                        onChange={e => setDmNoteBuffer(e.target.value)}
                        className="w-full h-44 sm:h-48 p-4 border border-gray-200 rounded-xl mb-4 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-100 outline-none transition-all resize-none"
                        placeholder="Private notes for/about this player..."
                    />
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowNoteEditor(false)} 
                            className="flex-1 py-3 font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleUpdateDMNotes} 
                            className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-200 transition-all active:scale-[0.98]"
                        >
                            Save Notes
                        </button>
                    </div>
                </div>
            </div>
       )}

       {/* Players Grid */}
    <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-400">
                  <p>Waiting for slayers to join...</p>
              </div>
          ) : (
             players.map(player => (
                 <div key={player.id} className={`relative block transition-all rounded-xl ${targetIds.has(player.id) ? 'ring-2 ring-slayer-orange transform scale-[1.02]' : 'hover:ring-1 hover:ring-gray-300'}`}>
                     <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                     {/* Player Header */}
                     <div className="bg-gray-50 p-3 border-b border-gray-100 flex justify-between items-center cursor-pointer" onClick={() => toggleTarget(player.id)}>
                         <div className="flex items-center gap-3">
                             <div className={`text-slayer-orange transition-all ${targetIds.has(player.id) ? 'opacity-100' : 'opacity-30'}`}>
                                 {targetIds.has(player.id) ? <CheckSquare size={20} fill="currentColor" className="text-white bg-slayer-orange rounded"/> : <Square size={20} className="text-gray-300"/>}
                             </div>
                             <h3 className="font-bold text-gray-800">{player.name}</h3>
                         </div>
                         <div className="flex items-center gap-2">
                            <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded">Lvl {player.level}</span>
                            <Link to={`/character/${player.id}`} className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-slayer-orange hover:border-slayer-orange transition-colors">
                                <ArrowLeft size={14} className="rotate-180" />
                            </Link>
                         </div>
                     </div>

                     {/* Stats */}
                     <div className="p-4 space-y-4" onClick={() => toggleTarget(player.id)}>
                         {/* HP */}
                         <div>
                             <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                                 <span className="flex items-center gap-1"><Heart size={12} className="text-red-500"/> HP</span>
                                 <span>{player.currentHP} / {player.maxHP}</span>
                             </div>
                             <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                 <div 
                                    className="h-full bg-red-500 transition-all duration-500"
                                    style={{ width: `${(player.currentHP / player.maxHP) * 100}%` }}
                                 />
                             </div>
                         </div>

                         {/* SP/Breath */}
                         {(player.type !== 'demon') && player.maxBreaths > 0 && (
                             <div>
                                 <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                                     <span className="flex items-center gap-1"><Wind size={12} className="text-cyan-500"/> Breath</span>
                                     <span>{player.currentBreaths} / {player.maxBreaths}</span>
                                 </div>
                                 <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                     <div 
                                        className={`h-full transition-all duration-500 ${player.currentBreaths < 0 ? 'bg-red-600' : 'bg-cyan-500'}`}
                                        style={{ width: `${Math.min(100, Math.max(0, (player.currentBreaths / player.maxBreaths) * 100))}%` }}
                                     />
                                 </div>
                             </div>
                         )}
                     </div>
                 </div>
                 </div>
             ))
          )}
       </div>
    </div>
  );
}

function ToolTab({ active, onClick, icon, label, color }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, color: string }) {
    return (
        <button 
            onClick={onClick}
            className={`flex-1 flex flex-col items-center justify-center p-4 min-w-[80px] transition-all relative ${active ? 'bg-white' : 'bg-gray-50 hover:bg-gray-100'}`}
        >
            <div className={`mb-1 transition-colors ${active ? color : 'text-gray-400'}`}>
                {icon}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wide transition-colors ${active ? 'text-gray-800' : 'text-gray-400'}`}>
                {label}
            </span>
            {active && (
                <motion.div 
                    layoutId="activeTab"
                    className={`absolute bottom-0 left-0 right-0 h-1 ${color.replace('text-', 'bg-')}`}
                />
            )}
        </button>
    );
}
