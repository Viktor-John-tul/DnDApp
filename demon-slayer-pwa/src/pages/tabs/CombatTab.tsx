import { useState } from 'react';
import { Swords, Wind, Zap, AlertTriangle, Plus, Minus, ShieldAlert, X } from 'lucide-react';
import type { RPGCharacter, BreathingForm } from '../../types';
import { Calculator } from '../../services/rules';
import { DiceRollerOverlay } from '../../components/DiceRollerOverlay';
import { BreathingFormEditorModal } from '../../components/BreathingFormEditorModal';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  character: RPGCharacter;
  onUpdate: (updates: Partial<RPGCharacter>) => void;
  readOnly?: boolean;
}

interface ActiveRollState {
  label: string;
  modifier: number;
  mode?: 'normal' | 'advantage' | 'disadvantage';
  isSave?: boolean;
  isDamage?: boolean;
  isHealing?: boolean;
  isBacklash?: boolean;
  isAttack?: boolean;
  diceCount?: number;
  diceFace?: number;
  pendingForm?: BreathingForm;
  pendingRefCost?: number;
}

export function CombatTab({ character, onUpdate, readOnly }: Props) {
  const [activeRoll, setActiveRoll] = useState<ActiveRollState | null>(null);
  const [showOverdraftWarning] = useState(false);
  const [editingForm, setEditingForm] = useState<BreathingForm | null>(null);
  const [pendingHitConfirmForm, setPendingHitConfirmForm] = useState<BreathingForm | null>(null);
  const [healingConfig, setHealingConfig] = useState<{
      show: boolean;
      pendingForm?: BreathingForm;
      count: number;
      face: number;
  }>({ show: false, count: 1, face: 8 });

  const conMod = Calculator.getModifier(character.constitution);
  const strMod = Calculator.getModifier(character.strength);
  const dexMod = Calculator.getModifier(character.dexterity);
  const proficiency = Calculator.getProficiencyBonus(character.level);

  // Encumbrance
  const currentLoad = Calculator.getCurrentLoad(character.inventory || []);
  const maxLoad = Calculator.getMaxLoad(character.strength);
  const isEncumbered = character.type === 'demon' ? false : currentLoad > maxLoad;

  const isDemon = character.type === 'demon';

  // Helper to determine best attack mod (Str vs Dex) - simplified
  const attackMod = Math.max(strMod, dexMod); 

  const handleBreathRecovery = () => {
    // Standard rule: Recover 1 + Con Mod (min 1)
    const amount = Math.max(1, 1 + conMod);
    const newBreaths = Math.min(character.maxBreaths, character.currentBreaths + amount);
    onUpdate({ currentBreaths: newBreaths });
  };

  const adjustBreath = (amount: number) => {
    const newVal = character.currentBreaths + amount;
    // If going negative or currently negative, Overdraft mechanics apply
    onUpdate({ currentBreaths: newVal });
  };

  const handleTechniqueRoll = (form: BreathingForm) => {
    const cost = form.spCost || 0;
    const nextBreaths = character.currentBreaths - cost;
    
    // Check for Overdraft Condition
    if (nextBreaths < 0 || character.currentBreaths < 0) {
        // Trigger Overdraft Save first
        setActiveRoll({
            label: `Overdraft Save (DC ${character.currentOverdraftDC})`,
            modifier: conMod + (character.proficientSavingThrows.includes("CON") ? proficiency : 0),
            isSave: true,
            pendingForm: form,
            pendingRefCost: cost
        } as any);
        return;
    }

    // Normal Execution
    commitTechnique(form, cost);
  };

  const commitTechnique = (form: BreathingForm, cost: number) => {
    const newBreaths = character.currentBreaths - cost;
    onUpdate({ currentBreaths: newBreaths });
    
    // Determine advantage state
    const hasAdvantageBuff = character.activeBuff?.isAdvantageBuff && (character.activeBuff.activeBuffRoundsRemaining || 0) > 0;
    
    // Resolve Advantage/Disadvantage cancellation
    let rollMode: 'normal' | 'advantage' | 'disadvantage' = 'normal';
    if (isEncumbered && !hasAdvantageBuff) rollMode = 'disadvantage';
    else if (!isEncumbered && hasAdvantageBuff) rollMode = 'advantage';
    else if (isEncumbered && hasAdvantageBuff) rollMode = 'normal'; // Cancel out

    // Check if form requires attack roll
    if (form.requiresAttackRoll) {
        setActiveRoll({
            label: `${form.name} (Attack)`,
            modifier: attackMod + proficiency, // Attack Roll Mod
            mode: rollMode,
            isAttack: true,
            pendingForm: form
        });
    } else {
        // No attack roll needed? Apply effect immediately
        applyFormEffect(form);
    }
  };

  const applyFormEffect = (form: BreathingForm) => {
      // 1. Damage Effect
      if (form.effectType === 'damage') {
          // Calculate Dice: Base + Buff
          let count = form.diceCount;
          let face = form.diceFace;
          let mod = 0; // Damage mod? Usually Ability Mod. 
          // Let's assume Ability Mod applies to damage too? User didn't specify but D&D standard says yes.
          mod = Math.max(strMod, dexMod); // Using same stat as attack for simplicity

          // Apply Active Buff if exists
          if (character.activeBuff?.activeBuffDiceCount && (character.activeBuff.activeBuffRoundsRemaining || 0) > 0) {
              count += character.activeBuff.activeBuffDiceCount;
              // What if face is different? "increases the amount of dice rolled". We assume same face or just add count.
              // If face is different, it's complicated. Let's assume we add dice of the form's face?
              // Or the buff's face? "adds an effect... which increses the amount of dice".
              // Let's assume simplicity: It adds to the COUNT.
          }
          
          setTimeout(() => {
              setActiveRoll({
                label: `${form.name} (Damage)`,
                modifier: mod, 
                isDamage: true,
                diceCount: count,
                diceFace: face,
                pendingForm: form
            });
          }, 300);
          return;
      }

      // 2. Buff Effect
      if (form.effectType === 'attackBuff' || form.effectType === 'advantageBuff') {
          const updates: Partial<RPGCharacter> = {};
          
          updates.activeBuff = {
              activeBuffFormID: form.id,
              activeBuffName: form.name,
              activeBuffDiceCount: form.effectType === 'attackBuff' ? form.diceCount : null,
              activeBuffDiceFace: form.effectType === 'attackBuff' ? form.diceFace : null,
              activeBuffRoundsRemaining: form.durationRounds,
              isAdvantageBuff: form.effectType === 'advantageBuff'
          };
          
          onUpdate(updates);
          alert(`Buff Applied: ${form.name}!`);
          return;
      }

      // 3. Heal Effect
      if (form.effectType === 'heal') {
          if (isDemon) {
              setHealingConfig({
                  show: true,
                  pendingForm: form,
                  count: form.diceCount || 1,
                  face: form.diceFace || 8
              });
              return;
          }

          setTimeout(() => {
              setActiveRoll({
                label: `${form.name} (Healing)`,
                modifier: 0,
                isHealing: true,
                diceCount: form.diceCount,
                diceFace: form.diceFace,
                pendingForm: form
            });
          }, 300);
          return;
      }
  };


  const handleRollComplete = (total?: number) => {
    if (total === undefined) return; // Should not happen in result state

    // If this was a Save, handle logic
    if (activeRoll?.isSave) {
        const passed = total >= character.currentOverdraftDC;
        const updates: Partial<RPGCharacter> = {};

        // 1. Apply Cost (always happens)
        // We know pendingRefCost exists because we set it in handleTechniqueRoll, but TS might complain if we don't access via 'any' or verify.
        // But since we defined ActiveRollState roughly, let's just cast carefully or rely on new type.
        // Wait, I updated ActiveRollState but 'pendingRefCost' is NOT in it yet!
        // I need to add pendingRefCost to ActiveRollState or cast effectively.
        const pendingRefCost = (activeRoll as any).pendingRefCost; 

        updates.currentBreaths = character.currentBreaths - pendingRefCost;

        // 2. Increment DC for next time (always happens when using form under 0)
        updates.currentOverdraftDC = character.currentOverdraftDC + 5;

        // 3. Damage if failed
        if (!passed) {
             // Trigger Damage Roll Visual
             setTimeout(() => {
                setActiveRoll({
                    label: "Backlash Damage!",
                    modifier: 0,
                    isDamage: true,
                    isBacklash: true,
                    diceCount: 2, 
                    diceFace: 8,
                    pendingForm: activeRoll.pendingForm
                });
             }, 300);
             onUpdate(updates); 
             // Note: We haven't applied HP damage yet, will do it after damage roll
             return;
        } else {
            // Overdraft Save Passed
            onUpdate(updates);
        }

        setActiveRoll(null);

        // 4. Continue to Attack Roll immediately
        if (activeRoll.pendingForm) {
            const form = activeRoll.pendingForm; // capture for closure
            setTimeout(() => {
                // Determine roll mode again for this specific attack
                // We likely need to duplicate logic or pass it. 
                // Simplified: recalculate based on current state (encumbrance/buffs unchanged in 300ms)
                const hasAdvantageBuff = character.activeBuff?.isAdvantageBuff && (character.activeBuff.activeBuffRoundsRemaining || 0) > 0;
                let rollMode: 'normal'|'advantage'|'disadvantage' = 'normal';
                if (isEncumbered && !hasAdvantageBuff) rollMode = 'disadvantage';
                else if (!isEncumbered && hasAdvantageBuff) rollMode = 'advantage';
                else if (isEncumbered && hasAdvantageBuff) rollMode = 'normal';

                setActiveRoll({
                    label: `${form.name} (Attack)`,
                    modifier: attackMod + proficiency,
                    mode: rollMode,
                    isAttack: true, // Mark as attack to trigger applyFormEffect next
                    pendingForm: form
                });
            }, 500);
        }
        return;
    }

    // If this was an Attack Roll for a Form
    if (activeRoll?.isAttack && activeRoll.pendingForm) {
        // Ask for confirmation
        setPendingHitConfirmForm(activeRoll.pendingForm);
        setActiveRoll(null);
        return;
    }

    // If this was a Healing Roll
    if (activeRoll?.isHealing) {
        onUpdate({
            currentHP: Math.min(Calculator.getMaxHP(character.constitution, character.level), character.currentHP + total)
        });
        setActiveRoll(null);
        return;
    }

    // If this was the Damage Roll
    if (activeRoll?.isDamage) {
        // Backlash Damage Logic (HP Loss + Resume Attack)
        if (activeRoll.isBacklash) {
            const dmg = total;
            
            onUpdate({ 
                currentHP: Math.max(0, character.currentHP - dmg) 
            });

            setActiveRoll(null);

            // Continue to Attack Loop
            if (activeRoll.pendingForm) {
                const form = activeRoll.pendingForm;
                
                setTimeout(() => {
                    // Re-evaluate mode
                    const hasAdvantageBuff = character.activeBuff?.isAdvantageBuff && (character.activeBuff.activeBuffRoundsRemaining || 0) > 0;
                    let rollMode: 'normal'|'advantage'|'disadvantage' = 'normal';
                    if (isEncumbered && !hasAdvantageBuff) rollMode = 'disadvantage';
                    else if (!isEncumbered && hasAdvantageBuff) rollMode = 'advantage';
                    else if (isEncumbered && hasAdvantageBuff) rollMode = 'normal';

                    if (form.requiresAttackRoll) {
                        setActiveRoll({
                            label: `${form.name} (Attack)`,
                            modifier: attackMod + proficiency,
                            mode: rollMode,
                            isAttack: true,
                            pendingForm: form
                        });
                    } else {
                        applyFormEffect(form);
                    }
                }, 500);
            }
            return;
        }

        // Standard Form Damage Logic (Just finish)
        setActiveRoll(null);
        return;
    }

    setActiveRoll(null);
  };

  const getBreathColor = () => {
    if (character.currentBreaths < 0) return "bg-red-600 text-white"; // Overdraft
    if (character.currentBreaths <= character.maxBreaths * 0.25) return "bg-yellow-500 text-white";
    return "bg-cyan-500 text-white";
  };

  const overdraftDC = 10 + Math.abs(Math.min(0, character.currentBreaths));

  return (
    <div className="space-y-6 pb-24">
      
      {/* Stamina / Breath Engine */}
      {!isDemon && (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden">
        {character.currentBreaths < 0 && (
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse" />
        )}
        
        <div className="flex justify-between items-start mb-4">
            <div>
                <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Breaths (SP)</h3>
                <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-black ${character.currentBreaths < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                        {character.currentBreaths}
                    </span>
                    <span className="text-gray-400 font-medium">/ {character.maxBreaths}</span>
                </div>
            </div>
            
            <button 
                onClick={handleBreathRecovery}
                className="flex items-center gap-2 bg-cyan-50 text-cyan-700 px-3 py-2 rounded-lg text-sm font-bold active:scale-95 transition-transform"
            >
                <Wind size={16} />
                Breathe
            </button>
        </div>

        {/* Bar */}
        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden mb-4">
            <motion.div 
                className={`h-full rounded-full ${getBreathColor()}`}
                initial={{ width: 0 }}
                animate={{ 
                    width: `${Math.min(100, Math.max(0, (character.currentBreaths / character.maxBreaths) * 100))}%` 
                }}
            />
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center">
            <div className="flex gap-2">
                <button onClick={() => adjustBreath(-1)} className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 active:bg-gray-200">
                    <Minus size={16} />
                </button>
                <button onClick={() => adjustBreath(1)} className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 active:bg-gray-200">
                    <Plus size={16} />
                </button>
            </div>

            {character.currentBreaths < 0 && (
                <div className="flex items-center gap-2 text-red-600 text-xs font-bold bg-red-50 px-2 py-1 rounded">
                    <ShieldAlert size={14} />
                    DC {overdraftDC} Save
                </div>
            )}

            {isEncumbered && (
                <div className="flex items-center gap-2 text-orange-600 text-xs font-bold bg-orange-50 px-2 py-1 rounded">
                    <AlertTriangle size={14} />
                    Encumbered
                </div>
            )}
        </div>
      </div>
      )}

      {/* Techniques List */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
            <h3 className="font-bold text-gray-800">{isDemon ? 'Blood Demon Arts' : 'Breathing Forms'}</h3>
            {!readOnly && (
            <button 
                onClick={() => setEditingForm({
                    id: crypto.randomUUID(), 
                    name: isDemon ? "New Blood Art" : "New Form",
                    description: "",
                    requiresAttackRoll: true,
                    durationRounds: 0,
                    diceCount: 1,
                    diceFace: 6,
                    spCost: 0,
                    effectType: 'damage'
                })}
                className="text-xs bg-gray-900 text-white px-2 py-1 rounded-md font-bold"
            >
                {isDemon ? "Add Art" : "Add Form"}
            </button>
            )}
        </div>
        
        {character.breathingForms.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400">
                <Wind className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No techniques learned yet.</p>
            </div>
        ) : (
            character.breathingForms.map(form => (
                <div key={form.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                    <div className={`flex-1 ${!readOnly ? 'cursor-pointer' : ''}`} onClick={() => !readOnly && setEditingForm(form)}>
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-800">{form.name}</h4>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 uppercase">
                                {form.diceCount}d{form.diceFace}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1">{form.description}</p>
                    </div>

                    <div className="flex items-center gap-3">
                         <div className="text-center min-w-[30px]">
                            <span className="block text-[10px] text-gray-400 font-bold uppercase">Cost</span>
                            <span className="block font-bold text-cyan-600">{form.spCost}</span>
                        </div>
                        <button 
                            onClick={() => !readOnly && handleTechniqueRoll(form)}
                            disabled={readOnly}
                            className={`p-2.5 rounded-xl shadow-lg transition-all ${readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-900 text-white shadow-gray-200 active:scale-95'}`}
                        >
                            <Swords size={18} />
                        </button>
                    </div>
                </div>
            ))
        )}
      </div>

      {/* Editor Modal */}
      {editingForm && (
        <BreathingFormEditorModal 
            form={editingForm} 
            onSave={(updatedForm) => {
                const exists = character.breathingForms.find(f => f.id === updatedForm.id);
                let newForms;
                if (exists) {
                    newForms = character.breathingForms.map(f => f.id === updatedForm.id ? updatedForm : f);
                } else {
                    newForms = [...character.breathingForms, updatedForm];
                }
                onUpdate({ breathingForms: newForms });
                setEditingForm(null);
            }}
            onClose={() => setEditingForm(null)}
        />
      )}

      {/* Basic Attacks Placeholder */}
      <div className="space-y-3">
         <div className="flex justify-between items-center px-1">
            <h3 className="font-bold text-gray-800">Basic Actions</h3>
         </div>
         <button 
            onClick={() => !readOnly && setActiveRoll({
                label: "Unarmed Strike", 
                modifier: strMod + proficiency,
                mode: isEncumbered ? 'disadvantage' : 'normal'
            })}
            disabled={readOnly}
            className={`w-full p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center ${readOnly ? 'bg-gray-50 opacity-50 cursor-not-allowed' : 'bg-white active:bg-gray-50'}`}
         >
            <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-lg">
                    <Zap size={18} className="text-gray-600"/>
                </div>
                <span className="font-bold text-sm text-gray-700">Unarmed Strike</span>
            </div>
            <span className="text-xs font-bold text-gray-400">1d4 + {strMod}</span>
         </button>
      </div>

      {pendingHitConfirmForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center"
            >
                <div className="mx-auto w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                    <Swords size={24} />
                </div>
                <h3 className="font-bold text-xl text-gray-900 mb-2">Did the Attack Hit?</h3>
                <p className="text-sm text-gray-500 mb-6">Confirm if your attack roll met the target's AC.</p>
                
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => setPendingHitConfirmForm(null)}
                        className="py-3 px-4 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    >
                        Miss
                    </button>
                    <button 
                         onClick={() => {
                             const form = pendingHitConfirmForm;
                             setPendingHitConfirmForm(null);
                             applyFormEffect(form);
                         }}
                        className="py-3 px-4 rounded-xl bg-slayer-orange text-white font-bold hover:bg-orange-600 active:scale-95 transition-all shadow-lg shadow-orange-200"
                    >
                        Hit!
                    </button>
                </div>
            </motion.div>
        </div>
      )}

      {healingConfig.show && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center"
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-xl text-gray-900">Configure Healing</h3>
                    <button onClick={() => setHealingConfig({...healingConfig, show: false})} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Dice Count</label>
                        <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-200">
                             <button 
                                onClick={() => setHealingConfig(prev => ({...prev, count: Math.max(1, prev.count - 1)}))}
                                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                             >
                                 <Minus size={18} />
                             </button>
                             <div className="flex-1 text-center font-mono text-xl text-gray-900 font-bold">{healingConfig.count}</div>
                             <button 
                                onClick={() => setHealingConfig(prev => ({...prev, count: prev.count + 1}))}
                                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                             >
                                 <Plus size={18} />
                             </button>
                        </div>
                    </div>
                    <div>
                         <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Dice Type</label>
                         <select 
                            value={healingConfig.face}
                            onChange={(e) => setHealingConfig(prev => ({...prev, face: parseInt(e.target.value)}))}
                            className="w-full h-[50px] bg-gray-50 border-gray-200 text-gray-900 rounded-xl focus:ring-2 focus:ring-slayer-orange focus:border-transparent px-3 font-bold"
                         >
                             <option value="4">d4</option>
                             <option value="6">d6</option>
                             <option value="8">d8</option>
                             <option value="10">d10</option>
                             <option value="12">d12</option>
                             <option value="20">d20</option>
                         </select>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                   <div className="text-sm text-gray-500 mb-1">Rolling</div>
                   <div className="text-2xl font-bold text-slayer-orange">
                       {healingConfig.count}d{healingConfig.face}
                   </div>
                </div>

                <button 
                     onClick={() => {
                         const { pendingForm, count, face } = healingConfig;
                         setHealingConfig({...healingConfig, show: false});
                         
                         setTimeout(() => {
                            setActiveRoll({
                                label: `${pendingForm?.name || 'Effect'} (Healing)`,
                                modifier: 0,
                                isHealing: true,
                                diceCount: count,
                                diceFace: face,
                                pendingForm: pendingForm
                            });
                         }, 100);
                     }}
                    className="w-full py-3 px-4 rounded-xl bg-slayer-orange text-white font-bold hover:bg-orange-600 active:scale-95 transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-2"
                >
                    <Plus size={20} />
                    <span>Roll Healing</span>
                </button>
            </motion.div>
          </div>
      )}

      {activeRoll && (
        <DiceRollerOverlay 
            mode={activeRoll.mode || "normal"}
            modifier={activeRoll.modifier}
            label={activeRoll.label} 
            diceCount={activeRoll.diceCount}
            diceFace={activeRoll.diceFace}
            onComplete={handleRollComplete}
        />
      )}

      <AnimatePresence>
        {showOverdraftWarning && (
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 z-50 pointer-events-none"
            >
                <AlertTriangle size={16} />
                <span className="text-xs font-bold">Overdraft Warning!</span>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
