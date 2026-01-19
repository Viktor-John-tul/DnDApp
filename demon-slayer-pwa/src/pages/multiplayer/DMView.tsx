import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { GameService } from "../../services/gameService";
import { CharacterService } from "../../services/characterService";
import type { GameSession } from "../../services/gameService";
import type { StatusEffect, InventoryItem } from "../../types";
import { Copy, Users, Heart, Wind, Power, ArrowLeft, Sparkles, CheckSquare, Square, Backpack, FileText } from 'lucide-react';

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
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);

  // DM Tools State
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [targetIds, setTargetIds] = useState<Set<string>>(new Set());
  const [applyingEffect, setApplyingEffect] = useState(false);

  // Item Adding State
  const [newItemParams, setNewItemParams] = useState({ name: "", quantity: 1, weight: 0 });
  
  // Note Editing State
  const [dmNoteBuffer, setDmNoteBuffer] = useState("");
  const [showNoteEditor, setShowNoteEditor] = useState(false);

  // Initialize Game Session
  useEffect(() => {
    const initGame = async () => {
      if (!user) return;
      try {
        // Try to resume an existing session first
        const existingCode = await GameService.resumeSession(user.uid);
        if (existingCode) {
            setSessionCode(existingCode);
        } else {
            // Only create if none exists
            const code = await GameService.createGame(user.uid);
            setSessionCode(code);
        }
      } catch (err) {
        console.error("Failed to create/resume game", err);
      }
    };
    initGame();
  }, [user]);

  // Subscribe to Session
  useEffect(() => {
    if (!sessionCode) return;
    
    const unsubscribe = GameService.subscribeToSession(sessionCode, (data) => {
      if (!data) {
          // Session was deleted remotely
          setSessionCode(null);
          setSession(null);
          navigate("/"); // Go back to dashboard if session ends
          return;
      }
      setSession(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [sessionCode, navigate]);

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
          setSessionCode(null);
          navigate("/");
      } catch (err) {
          console.error(err);
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

  if (loading || !sessionCode) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-slayer-orange border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500 font-bold">Accessing Session...</p>
        </div>
      </div>
    );
  }

  const players = Object.values(session?.players || {});

  return (
    <div className="min-h-screen bg-gray-100 p-4 pb-24">
       {/* Header / HUD */}
       <div className="bg-gray-900 text-white p-4 rounded-xl shadow-lg mb-6 sticky top-2 z-10">
          <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <Link to="/" className="text-gray-400 hover:text-white"><ArrowLeft size={20}/></Link>
                <h1 className="font-bold text-lg">DM Overwatch</h1>
              </div>
              
              <button 
                onClick={handleEndSession}
                className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs font-bold border border-red-900 bg-red-900/20 px-2 py-1 rounded"
              >
                  <Power size={12} /> END
              </button>
          </div>

          <div className="flex justify-between items-end">
            <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
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

       {/* DM Tools Panel */}
       <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 space-y-6">
           {/* Section 1: Status Effects */}
           <div>
               <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Sparkles size={18} className="text-slayer-orange"/> Apply Status Effect</h3>
               <div className="flex flex-wrap gap-2 mb-4">
                   {COMMON_EFFECTS.map(effect => (
                       <button
                           key={effect.name}
                           onClick={() => setSelectedEffect(effect.name)}
                           className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${selectedEffect === effect.name ? 'bg-slayer-orange text-white border-slayer-orange' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                       >
                           {effect.name}
                       </button>
                   ))}
               </div>
               {selectedEffect && (
                    <button 
                        onClick={handleApplyEffect}
                        disabled={targetIds.size === 0 || applyingEffect}
                        className="w-full bg-slayer-orange text-white font-bold py-3 rounded-xl disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-orange-100"
                    >
                        Apply {selectedEffect} to {targetIds.size} Player(s)
                    </button>
               )}
           </div>

           <div className="border-t border-gray-100"></div>

           {/* Section 2: Give Items */}
           <div>
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Backpack size={18} className="text-blue-500"/> Give Item</h3>
                <div className="flex gap-2 mb-2">
                    <input 
                        type="text" 
                        placeholder="Item Name"
                        value={newItemParams.name}
                        onChange={e => setNewItemParams({...newItemParams, name: e.target.value})}
                        className="flex-1 p-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <input 
                        type="number" 
                        placeholder="Qty"
                        value={newItemParams.quantity}
                        onChange={e => setNewItemParams({...newItemParams, quantity: Math.max(1, parseInt(e.target.value)||1)})}
                        className="w-16 p-2 border border-gray-200 rounded-lg text-sm text-center"
                    />
                </div>
                <button 
                    onClick={handleGiveItem}
                    disabled={targetIds.size === 0 || !newItemParams.name}
                    className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-blue-100"
                >
                    Give Item to {targetIds.size} Player(s)
                </button>
           </div>
           
           <div className="border-t border-gray-100"></div>

           {/* Section 3: DM Notes */}
           <div>
               <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><FileText size={18} className="text-purple-500"/> DM Notes</h3>
               <button 
                    onClick={openNoteEditor}
                    disabled={targetIds.size !== 1}
                    className="w-full bg-purple-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-purple-100"
               >
                   {targetIds.size === 1 ? "Edit DM Notes for Selected" : "Select exactly 1 player to edit notes"}
               </button>
           </div>
       </div>
       
       {showNoteEditor && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
                    <h3 className="font-bold text-lg mb-4">Edit DM Notes</h3>
                    <textarea 
                        value={dmNoteBuffer}
                        onChange={e => setDmNoteBuffer(e.target.value)}
                        className="w-full h-32 p-3 border border-gray-200 rounded-xl mb-4 text-sm"
                        placeholder="Private notes for/about this player..."
                    />
                    <div className="flex gap-2">
                        <button onClick={() => setShowNoteEditor(false)} className="flex-1 py-2 bg-gray-100 font-bold text-gray-600 rounded-lg">Cancel</button>
                        <button onClick={handleUpdateDMNotes} className="flex-1 py-2 bg-purple-500 text-white font-bold rounded-lg shadow-lg shadow-purple-200">Save</button>
                    </div>
                </div>
            </div>
       )}

       {/* Players Grid */}
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                     </div>
                 </div>
                 </div>
             ))
          )}
       </div>
    </div>
  );
}
