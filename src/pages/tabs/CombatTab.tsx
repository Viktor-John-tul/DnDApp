import { useState, useEffect } from 'react';
import { Swords, Wind, Zap, ZapOff, AlertTriangle, Plus, Minus, ShieldAlert, X, Heart, Shield, ArrowUp, ArrowDown, Clock, Lock, SkipForward } from 'lucide-react';
import type { RPGCharacter, BreathingForm, CombatAction } from '../../types';
import type { GameSession } from '../../services/gameService';
import { Calculator, resolveEquippedSpecialItemBonuses } from '../../services/rules';
import { DiceRollerOverlay } from '../../components/DiceRollerOverlay';
import { BreathingFormEditorModal } from '../../components/BreathingFormEditorModal';
import { CombatActionEditorModal } from '../../components/CombatActionEditorModal';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '../../context/ToastContext';
import { GameService } from '../../services/gameService';
import { getEffectiveMaxBreaths, getSlayerFormCost, isSlayerCharacter } from '../../services/slayerProgression';

interface Props {
  character: RPGCharacter;
  onUpdate: (updates: Partial<RPGCharacter>) => void;
  readOnly?: boolean;
  isDM?: boolean;
  session?: GameSession | null;
    onRollLogged?: (purpose: string, notation: string, total: number) => void;
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
  extraDice?: { count: number, face: number }[];
  pendingForm?: BreathingForm;
  pendingRefCost?: number;
    consumeFlowState?: boolean;
}

export function CombatTab({ character, onUpdate, readOnly, isDM, session, onRollLogged }: Props) {
  const { showToast } = useToast();
  const [activeRoll, setActiveRoll] = useState<ActiveRollState | null>(null);
  const [showOverdraftWarning] = useState(false);
  const [editingForm, setEditingForm] = useState<BreathingForm | null>(null);
  const [editingAction, setEditingAction] = useState<{action?: any, initialType?: any} | null>(null);
  
  // Action Economy State
  const [actionsUsed, setActionsUsed] = useState(0);
  const [bonusUsed, setBonusUsed] = useState(false);
        const [freeFormUsedThisTurn, setFreeFormUsedThisTurn] = useState(false);
    const [bladeMemoryUsedThisTurn, setBladeMemoryUsedThisTurn] = useState(false);
    const [usedFormsThisCombat, setUsedFormsThisCombat] = useState<Set<string>>(new Set());
    const [controlledBreathingUsed, setControlledBreathingUsed] = useState(false);
    const [flowStateReady, setFlowStateReady] = useState(false);
    // TODO: Reset controlledBreathingUsed on short/long rest when rest system exists.
    // TODO: Add rest-based counters for Battle Reflex and Unbroken Spirit.
  
  const [pendingHitConfirmForm, setPendingHitConfirmForm] = useState<BreathingForm | null>(null);
  const [healingConfig, setHealingConfig] = useState<{
      show: boolean;
      pendingForm?: BreathingForm;
      count: number;
      face: number;
  }>({ show: false, count: 1, face: 8 });

    const itemBonuses = resolveEquippedSpecialItemBonuses(character.inventory || []);
    const effectiveStrength = character.strength + itemBonuses.attributeBonuses.strength;
    const effectiveDexterity = character.dexterity + itemBonuses.attributeBonuses.dexterity;
    const effectiveConstitution = character.constitution + itemBonuses.attributeBonuses.constitution;
    const conMod = Calculator.getModifier(effectiveConstitution);
    const strMod = Calculator.getModifier(effectiveStrength);
    const dexMod = Calculator.getModifier(effectiveDexterity);
  const proficiency = Calculator.getProficiencyBonus(character.level);

  // Encumbrance
  const currentLoad = Calculator.getCurrentLoad(character.inventory || []);
    const maxLoad = Calculator.getMaxLoad(effectiveStrength) + itemBonuses.carryCapacityBonus;
  const isEncumbered = character.type === 'demon' ? false : currentLoad > maxLoad;

    const isDemon = character.type === 'demon';
    const isSlayer = isSlayerCharacter(character);
    const effectiveMaxBreaths = getEffectiveMaxBreaths(character);
    const canUseForms = isDemon || (isSlayer && character.level >= 2);

    // Combat & Action Economy Logic
    const combat = session?.combat;
    const isCombatActive = Boolean(combat?.isActive);
    const isMyTurn = isCombatActive && combat?.participants[combat.currentTurnIndex]?.id === character.id;
    const MAX_ACTIONS = isSlayer && character.level >= 12 ? 3 : 2;
    const actionStateKey = `combat-action-state:${character.id || 'unknown'}:${session?.code || 'no-session'}`;
    const buffRoundStateKey = `combat-buff-round:${character.id || 'unknown'}:${session?.code || 'no-session'}`;

  // Helper: Status Effects
  const removeEffect = (id: string) => {
      onUpdate({ statusEffects: (character.statusEffects || []).filter(e => e.id !== id) });
  };
  
  // Helper to determine best attack mod (Str vs Dex) - simplified
  const attackMod = Math.max(strMod, dexMod); 
    const attackRollModifier = attackMod + proficiency + itemBonuses.attackBonus;
    const damageRollModifier = itemBonuses.damageBonus;

    const hasActiveAdvantageBuff = () => {
        const fromLegacyBuff = Boolean(
            character.activeBuff?.isAdvantageBuff && (character.activeBuff.activeBuffRoundsRemaining || 0) > 0
        );
        const fromBuffStack = (character.activeBuffs || []).some(
            (buff) => Boolean(buff.isAdvantageBuff) && (buff.activeBuffRoundsRemaining || 0) > 0
        );
        return fromLegacyBuff || fromBuffStack;
    };

    const getAttackRollMode = (): 'normal' | 'advantage' | 'disadvantage' => {
        const hasEffectAdvantage = character.statusEffects?.some((e) => e.type === 'advantage');
        const hasEffectDisadvantage = character.statusEffects?.some((e) => e.type === 'disadvantage');
        const hasAdv = hasActiveAdvantageBuff() || hasEffectAdvantage || itemBonuses.attackAdvantage;
        const hasDis = isEncumbered || hasEffectDisadvantage;

        if (hasAdv && !hasDis) return 'advantage';
        if (!hasAdv && hasDis) return 'disadvantage';
        return 'normal';
    };

  const handleBreathRecovery = () => {
    // Check bonus action economy in combat
    if (combat?.isActive && !canUseAction('bonus')) {
      showToast("Bonus action already used!", "error");
      return;
    }

    // Bonus Action: Recover All Breaths + Reset Overdraft DC to 15
    onUpdate({ 
        currentBreaths: effectiveMaxBreaths,
        currentOverdraftDC: 15
    });

    // Consume bonus action in combat
    if (combat?.isActive && isMyTurn) {
      useAction('bonus');
    }
  };

  const getOrdinal = (n: number) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const moveForm = (index: number, direction: 'up' | 'down') => {
      if (readOnly) return;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= character.breathingForms.length) return;
      
      const newForms = [...character.breathingForms];
      const temp = newForms[index];
      newForms[index] = newForms[newIndex];
      newForms[newIndex] = temp;
      
      onUpdate({ breathingForms: newForms });
  };

    const handleTechniqueRoll = (form: BreathingForm, formNumber: number) => {
        if (isSlayer && character.level < 2) {
            showToast("Breathing forms unlock at level 2.", "info");
            return;
        }

        // Check action economy in combat
        if (isCombatActive && !canUseAction('main')) {
            showToast("No actions remaining!", "error");
            return;
        }

        const canFreeForm = isSlayer && character.level >= 2 && formNumber === 1 && isCombatActive && isMyTurn && !freeFormUsedThisTurn;
        const canBladeMemory = isSlayer && character.level >= 12 && isCombatActive && isMyTurn && !bladeMemoryUsedThisTurn;
        const bladeMemoryApplies = canBladeMemory && usedFormsThisCombat.has(form.id);

        const baseCost = isDemon
            ? 0
            : getSlayerFormCost(character.level, formNumber, bladeMemoryApplies && !canFreeForm);
        const cost = canFreeForm ? 0 : baseCost;
        const nextBreaths = character.currentBreaths - cost;

        setUsedFormsThisCombat(prev => new Set(prev).add(form.id));
        if (canFreeForm) setFreeFormUsedThisTurn(true);
        if (bladeMemoryApplies && !canFreeForm) setBladeMemoryUsedThisTurn(true);

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

        // Consume action in combat
        if (isCombatActive && isMyTurn) {
            useAction('main');
        }
    };

  const commitTechnique = (form: BreathingForm, cost: number) => {
    const newBreaths = character.currentBreaths - cost;
    onUpdate({ currentBreaths: newBreaths });
    
    // Determine roll mode
    const rollMode = getAttackRollMode();

    // Check if form requires attack roll
    if (form.requiresAttackRoll) {
        setActiveRoll({
            label: `${form.name} (Attack)`,
            modifier: attackRollModifier, // Attack Roll Mod
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
          mod = Math.max(strMod, dexMod) + damageRollModifier; // Using same stat as attack for simplicity

          // Apply Active Buff if exists
          // Prevent Regen Buffs from incorrectly adding to damage dice
          const extraDice: { count: number, face: number }[] = [];
          const flowStateApplies = isSlayer && character.level >= 6 && flowStateReady;
          const breathingBeyondApplies = isSlayer && character.level >= 18 && effectiveMaxBreaths > 0 && character.currentBreaths <= effectiveMaxBreaths * 0.25;
          
          if (character.activeBuff?.activeBuffDiceCount && !character.activeBuff.isRegenBuff && (character.activeBuff.activeBuffRoundsRemaining || 0) > 0) {
              const buffCount = character.activeBuff.activeBuffDiceCount;
              const buffFace = character.activeBuff.activeBuffDiceFace || face; // Fallback to form face if undefined

              if (buffFace === face) {
                  // If faces match, just add to the main pool
                  count += buffCount;
              } else {
                  // If faces differ, add to extra dice
                  extraDice.push({ count: buffCount, face: buffFace });
              }
          }

          // Check for MULTIPLE Active Buffs 
          if (character.activeBuffs) {
              character.activeBuffs.forEach(buff => {
                  if (buff.activeBuffDiceCount && !buff.isRegenBuff && (buff.activeBuffRoundsRemaining || 0) > 0) {
                      const buffCount = buff.activeBuffDiceCount;
                      const buffFace = buff.activeBuffDiceFace || face;

                      if (buffFace === face) {
                          count += buffCount;
                      } else {
                          extraDice.push({ count: buffCount, face: buffFace });
                      }
                  }
              });
          }

          if (flowStateApplies) {
              extraDice.push({ count: 1, face: 4 });
          }

          if (breathingBeyondApplies) {
              extraDice.push({ count: 1, face: 6 });
          }
          
          setTimeout(() => {
              setActiveRoll({
                label: `${form.name} (Damage)`,
                modifier: mod, 
                isDamage: true,
                diceCount: count,
                diceFace: face,
                extraDice: extraDice,
                pendingForm: form,
                consumeFlowState: flowStateApplies
            });
          }, 300);
          return;
      }

      // 2. Buff Effect
      if (form.effectType === 'attackBuff' || form.effectType === 'advantageBuff') {
          const updates: Partial<RPGCharacter> = {};
          
          const newBuff = {
              activeBuffFormID: form.id,
              activeBuffName: form.name,
              activeBuffDiceCount: form.effectType === 'attackBuff' ? form.diceCount : null,
              activeBuffDiceFace: form.effectType === 'attackBuff' ? form.diceFace : null,
              activeBuffRoundsRemaining: form.durationRounds,
              isAdvantageBuff: form.effectType === 'advantageBuff'
          };

          // Stack buffs instead of replacing
          updates.activeBuffs = [...(character.activeBuffs || []), newBuff];
          
          onUpdate(updates);
          showToast(`Buff Applied: ${form.name}!`, 'success');
          if (isSlayer && character.level >= 6) {
              setFlowStateReady(true);
          }
          return;
      }

      // 3. Heal Effect
      if (form.effectType === 'heal') {
          // If duration > 0, treat as Regeneration Buff (Demon Style or otherwise)
          if (form.durationRounds > 0) {
              const updates: Partial<RPGCharacter> = {};
              const newBuff = {
                  activeBuffFormID: form.id,
                  activeBuffName: form.name,
                  activeBuffDiceCount: form.diceCount,
                  activeBuffDiceFace: form.diceFace,
                  activeBuffRoundsRemaining: form.durationRounds,
                  isRegenBuff: true
              };

              updates.activeBuffs = [...(character.activeBuffs || []), newBuff];
              onUpdate(updates);
              showToast(`Regeneration Applied: ${form.name}!`, 'success');
              if (isSlayer && character.level >= 6) {
                  setFlowStateReady(true);
              }
              return;
          }

          // Instant Heal (Fallback or 0 duration)
          setTimeout(() => {
              setActiveRoll({
                label: `${form.name} (Healing)`,
                modifier: 0,
                isHealing: true,
                diceCount: form.diceCount || 1,
                diceFace: form.diceFace || 8,
                pendingForm: form
            });
          }, 300);
          return;
      }
  };


  const handleRollComplete = (total?: number) => {
    if (total === undefined) return; // Should not happen in result state

        if (activeRoll) {
            const notation = activeRoll.diceCount && activeRoll.diceFace
                ? `${activeRoll.diceCount}d${activeRoll.diceFace}`
                : activeRoll.mode === 'advantage'
                    ? '2d20 (Advantage)'
                    : activeRoll.mode === 'disadvantage'
                        ? '2d20 (Disadvantage)'
                        : '1d20';
            onRollLogged?.(activeRoll.label, notation, total);
        }

    let baseUpdates: Partial<RPGCharacter> = {};
    
    // Decrement buff timers outside combat (each roll = 1 round)
    if (!combat?.isActive && (character.activeBuffs || []).length > 0) {
      const updatedBuffs = (character.activeBuffs || []).map(buff => ({
        ...buff,
        activeBuffRoundsRemaining: Math.max(0, (buff.activeBuffRoundsRemaining || 0) - 1)
      })).filter(buff => (buff.activeBuffRoundsRemaining || 0) > 0);
      
      baseUpdates.activeBuffs = updatedBuffs;
    }
    
    const hasOneTime = character.statusEffects?.some(e => e.type === 'advantage' || e.type === 'disadvantage');
    if (hasOneTime && (activeRoll?.isAttack || activeRoll?.isSave || activeRoll?.label === "Unarmed Strike")) {
        baseUpdates.statusEffects = (character.statusEffects || []).filter(e => e.type !== 'advantage' && e.type !== 'disadvantage');
    }

    // If this was a Save, handle logic
    if (activeRoll?.isSave) {
        const passed = total >= character.currentOverdraftDC;
        const updates: Partial<RPGCharacter> = { ...baseUpdates };

        const canIgnoreFail = isSlayer && character.level >= 4 && combat?.isActive && !controlledBreathingUsed;

        // 1. Apply Cost (always happens)
        const pendingRefCost = activeRoll.pendingRefCost || 0;

        updates.currentBreaths = character.currentBreaths - pendingRefCost;

        // 2. Increment DC for next time (always happens when using form under 0)
        updates.currentOverdraftDC = character.currentOverdraftDC + 5;

        // 3. Damage if failed
        if (!passed && canIgnoreFail) {
             setControlledBreathingUsed(true);
             showToast("Controlled Breathing: ignored failed overdraft damage.", "info");
             onUpdate(updates);

             setActiveRoll(null);

             if (activeRoll.pendingForm) {
                 const form = activeRoll.pendingForm;
                 setTimeout(() => {
                     const rollMode = getAttackRollMode();

                     setActiveRoll({
                         label: `${form.name} (Attack)`,
                         modifier: attackRollModifier,
                         mode: rollMode,
                         isAttack: true,
                         pendingForm: form
                     });
                 }, 500);
             }
             return;
        }

        if (!passed) {
             // Trigger Damage Roll Visual
             setTimeout(() => {
                setActiveRoll({
                    label: "Backlash Damage!",
                    modifier: damageRollModifier,
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
                const rollMode = getAttackRollMode();

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
        if (Object.keys(baseUpdates).length > 0) onUpdate(baseUpdates);
        // Ask for confirmation
        setPendingHitConfirmForm(activeRoll.pendingForm);
        setActiveRoll(null);
        return;
    }

    // If this was a Healing Roll
    if (activeRoll?.isHealing) {
        const healAmount = Number(total) || 0;
        const maxHP = character.customMaxHP ?? Calculator.getMaxHP(character.constitution, character.level);
        const newHP = Math.min(maxHP, (character.currentHP || 0) + healAmount);
        
        const updates: Partial<RPGCharacter> = {
            currentHP: newHP
        };

        // If this was a Regen Buff Roll (Active), decrement matching duration
        if (activeRoll.label === "Regeneration" && character.activeBuffs && activeRoll.pendingForm) {
             const matchingIndex = character.activeBuffs.findIndex(b => b.activeBuffName === activeRoll.pendingForm?.name);
             
             if (matchingIndex !== -1) {
                 const newBuffs = [...character.activeBuffs];
                 const buff = newBuffs[matchingIndex];
                 const remaining = (buff.activeBuffRoundsRemaining || 0) - 1;
                 
                 if (remaining <= 0) {
                     newBuffs.splice(matchingIndex, 1);
                 } else {
                     newBuffs[matchingIndex] = { ...buff, activeBuffRoundsRemaining: remaining };
                 }
                 updates.activeBuffs = newBuffs;
             }
        }

        onUpdate(updates);
        if (isSlayer && character.level >= 6 && activeRoll.pendingForm && activeRoll.label !== "Regeneration") {
            setFlowStateReady(true);
        }
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
                    const rollMode = getAttackRollMode();

                    if (form.requiresAttackRoll) {
                        setActiveRoll({
                            label: `${form.name} (Attack)`,
                            modifier: attackRollModifier,
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
        if (Object.keys(baseUpdates).length > 0) onUpdate(baseUpdates);
        // TODO: When target tracking exists, grant +10 current Breath for slayers at level 4+ on demon kills.
        if (activeRoll.consumeFlowState) {
            setFlowStateReady(false);
        }
        if (isSlayer && character.level >= 6 && activeRoll.pendingForm) {
            setFlowStateReady(true);
        }
        setActiveRoll(null);
        return;
    }

    if (Object.keys(baseUpdates).length > 0) onUpdate(baseUpdates);
    setActiveRoll(null);
  };

  const getBreathColor = () => {
    if (character.currentBreaths < 0) return "bg-red-600 text-white"; // Overdraft
        if (character.currentBreaths <= effectiveMaxBreaths * 0.25) return "bg-yellow-500 text-white";
    return "bg-cyan-500 text-white";
  };

  const overdraftDC = 10 + Math.abs(Math.min(0, character.currentBreaths));

  // Reset action economy when turn changes
  useEffect(() => {
    if (isMyTurn) {
      setActionsUsed(0);
      setBonusUsed(false);
            setFreeFormUsedThisTurn(false);
            setBladeMemoryUsedThisTurn(false);
    }
    }, [combat?.currentTurnIndex, combat?.round, isMyTurn]);

    useEffect(() => {
        if (!combat?.isActive) {
            setUsedFormsThisCombat(new Set());
            setControlledBreathingUsed(false);
            setFreeFormUsedThisTurn(false);
            setBladeMemoryUsedThisTurn(false);
                        sessionStorage.removeItem(buffRoundStateKey);
        }
        }, [combat?.isActive, buffRoundStateKey]);

  // Decrement buff timers when round changes in combat
  useEffect(() => {
        if (!combat?.isActive || !combat.round) return;

        const lastProcessedRound = Number(sessionStorage.getItem(buffRoundStateKey) || 0);
        if (combat.round <= lastProcessedRound) return;
    
    const activeBuffs = character.activeBuffs || [];
        if (activeBuffs.length === 0) {
            sessionStorage.setItem(buffRoundStateKey, String(combat.round));
            return;
        }

    // Decrement all active buff timers
    const updatedBuffs = activeBuffs.map(buff => ({
      ...buff,
      activeBuffRoundsRemaining: Math.max(0, (buff.activeBuffRoundsRemaining || 0) - 1)
    })).filter(buff => (buff.activeBuffRoundsRemaining || 0) > 0);

        const hasRoundChange = activeBuffs.some((buff, index) => {
            const nextBuff = updatedBuffs[index];
            return !nextBuff || nextBuff.activeBuffRoundsRemaining !== buff.activeBuffRoundsRemaining;
        });

        if (hasRoundChange || updatedBuffs.length !== activeBuffs.length) {
      onUpdate({ activeBuffs: updatedBuffs });
    }
        sessionStorage.setItem(buffRoundStateKey, String(combat.round));
    }, [combat?.round, combat?.isActive, buffRoundStateKey, character.activeBuffs, onUpdate]);

  const handleEndTurn = async () => {
    if (!session?.code || !combat) return;
    try {
      await GameService.nextTurn(session.code);
      showToast("Turn ended", "info");
    } catch (error) {
      console.error("Failed to end turn", error);
      showToast("Failed to end turn", "error");
    }
  };

  const canUseAction = (type: 'main' | 'bonus') => {
    if (!combat?.isActive) return true; // No combat, no restrictions
    if (!isMyTurn) return false; // Not your turn
    if (type === 'main') return actionsUsed < MAX_ACTIONS;
    if (type === 'bonus') return !bonusUsed;
    return true;
  };

  const useAction = (type: 'main' | 'bonus') => {
    if (type === 'main') setActionsUsed(prev => prev + 1);
    if (type === 'bonus') setBonusUsed(true);
  };

    useEffect(() => {
        if (!isCombatActive || !isMyTurn) return;

        try {
            const raw = sessionStorage.getItem(actionStateKey);
            if (!raw) return;

            const parsed = JSON.parse(raw) as {
                round: number;
                turnIndex: number;
                actionsUsed: number;
                bonusUsed: boolean;
                freeFormUsedThisTurn: boolean;
                bladeMemoryUsedThisTurn: boolean;
            };

            if (parsed.round === combat?.round && parsed.turnIndex === combat?.currentTurnIndex) {
                setActionsUsed(parsed.actionsUsed || 0);
                setBonusUsed(Boolean(parsed.bonusUsed));
                setFreeFormUsedThisTurn(Boolean(parsed.freeFormUsedThisTurn));
                setBladeMemoryUsedThisTurn(Boolean(parsed.bladeMemoryUsedThisTurn));
            }
        } catch {
            // Ignore malformed cached state.
        }
    }, [actionStateKey, combat?.currentTurnIndex, combat?.round, isCombatActive, isMyTurn]);

    useEffect(() => {
        if (!isCombatActive || !isMyTurn) return;

        sessionStorage.setItem(actionStateKey, JSON.stringify({
            round: combat?.round || 0,
            turnIndex: combat?.currentTurnIndex || 0,
            actionsUsed,
            bonusUsed,
            freeFormUsedThisTurn,
            bladeMemoryUsedThisTurn,
        }));
    }, [actionStateKey, actionsUsed, bladeMemoryUsedThisTurn, bonusUsed, combat?.currentTurnIndex, combat?.round, freeFormUsedThisTurn, isCombatActive, isMyTurn]);

  return (
    <div className="space-y-6 pb-24">
      
      {/* Combat Tracker */}
      {combat && combat.isActive && (
        <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl p-4 shadow-lg">
          <div className="flex justify-between items-center mb-3">
            <div>
              <div className="text-xs opacity-80 uppercase tracking-wide">Round {combat.round}</div>
              <div className="text-lg font-bold">
                {isMyTurn ? "YOUR TURN!" : `${combat.participants[combat.currentTurnIndex]?.name}'s Turn`}
              </div>
            </div>
            {isMyTurn && (
              <button
                onClick={handleEndTurn}
                disabled={readOnly}
                className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-100 transition flex items-center gap-2 disabled:opacity-50"
              >
                <SkipForward size={16} /> End Turn
              </button>
            )}
          </div>
          
          {/* Turn Order */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {combat.participants.filter(p => !p.isHidden || isDM).map((p, idx) => (
              <div
                key={p.id}
                className={`flex-shrink-0 flex flex-col items-center gap-1 ${
                  idx === combat.currentTurnIndex ? 'opacity-100' : 'opacity-50'
                }`}
              >
                {p.photoUrl ? (
                  <img
                    src={p.photoUrl}
                    alt={p.name}
                    className={`w-10 h-10 rounded-full object-cover border-2 ${
                      idx === combat.currentTurnIndex ? 'border-yellow-300' : 'border-white/30'
                    }`}
                  />
                ) : (
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs border-2 ${
                      idx === combat.currentTurnIndex 
                        ? 'bg-yellow-300 text-gray-900 border-yellow-300' 
                        : 'bg-white/20 border-white/30'
                    }`}
                  >
                    {p.name.charAt(0)}
                  </div>
                )}
                <span className="text-[10px] font-bold">{p.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>

          {/* Action Economy */}
          {isMyTurn && (
            <div className="mt-3 pt-3 border-t border-white/20 flex gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-80">Actions:</span>
                <div className="flex gap-1">
                  {[...Array(MAX_ACTIONS)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded border-2 ${
                        i < actionsUsed ? 'bg-white/30 border-white/50' : 'bg-white border-white'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-80">Bonus:</span>
                <div
                  className={`w-6 h-6 rounded border-2 ${
                    bonusUsed ? 'bg-white/30 border-white/50' : 'bg-white border-white'
                  }`}
                />
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Active Status Effects (DM Tools) */}
      <div className="flex flex-wrap gap-2 mb-2">
        {character.statusEffects?.map(effect => (
            <div key={effect.id} className={`${effect.type === 'condition' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-blue-50 text-blue-700 border-blue-100'} px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 shadow-sm`}>
                <span>{effect.name}</span>
                <button onClick={() => removeEffect(effect.id)} className="hover:bg-black/5 rounded p-0.5"><X size={12}/></button>
            </div>
        ))}
      </div>

      {/* Active Form Buffs (Regen/Attack/Advantage) */}
      <div className="space-y-2">
      {(character.activeBuffs || []).filter(b => (b.activeBuffRoundsRemaining || 0) > 0).map((buff, i) => (
         <div key={i} className="bg-orange-50 border border-orange-200 p-3 rounded-xl flex justify-between items-center animate-fade-in shadow-sm">
             <div className="flex items-center gap-3">
                 <div className="p-2 bg-white rounded-lg text-slayer-orange border border-orange-100 shadow-sm">
                     {buff.isRegenBuff ? <Heart size={20} /> : (buff.isAdvantageBuff ? <Shield size={20} /> : <Zap size={20} />)}
                 </div>
                 <div className="min-w-0">
                     <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active Art Effect</p>
                     <h3 className="font-bold text-gray-800 leading-tight truncate">{buff.activeBuffName}</h3>
                     <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-orange-600 font-bold bg-orange-100 px-1.5 py-0.5 rounded">
                            {buff.activeBuffRoundsRemaining} Rounds
                        </span>
                        {buff.activeBuffDiceCount && !buff.isAdvantageBuff && (
                            <span className="text-xs text-gray-500 font-bold">
                                ({buff.activeBuffDiceCount}d{buff.activeBuffDiceFace})
                            </span>
                        )}
                     </div>
                 </div>
             </div>
             <div className="flex items-center gap-2">
                {buff.isRegenBuff && !readOnly && (
                    <button 
                        onClick={() => {
                             // Use a dummy form to carry the name for matching
                             const dummyForm = { name: buff.activeBuffName, id: buff.activeBuffFormID } as any; 
                             setActiveRoll({
                                label: `Regeneration`,
                                modifier: 0,
                                isHealing: true,
                                diceCount: buff.activeBuffDiceCount || 1,
                                diceFace: buff.activeBuffDiceFace || 6,
                                pendingForm: dummyForm
                            });
                        }}
                        className="bg-white text-slayer-orange py-2 px-3 rounded-lg border border-orange-100 shadow-sm hover:bg-orange-50 active:scale-95 transition-all font-bold text-xs"
                    >
                        Roll Heal
                    </button>
                )}
                {!readOnly && (
                    <button 
                        onClick={() => {
                            const newBuffs = character.activeBuffs?.filter((_, index) => index !== i);
                            onUpdate({ activeBuffs: newBuffs });
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                        <X size={18} />
                    </button>
                )}
             </div>
         </div>
      ))}
      </div>
      
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
                    <span className="text-gray-400 font-medium">/ {effectiveMaxBreaths}</span>
                </div>
            </div>
        </div>

        {/* Bar */}
        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden mb-4">
            <motion.div 
                className={`h-full rounded-full ${getBreathColor()}`}
                initial={{ width: 0 }}
                animate={{ 
                    width: `${Math.min(100, Math.max(0, (character.currentBreaths / effectiveMaxBreaths) * 100))}%` 
                }}
            />
        </div>

        {/* Controls */}
        <div className="flex justify-end items-center">
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
            {!readOnly && canUseForms && (
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

        {!canUseForms && !isDemon && (
            <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-500 text-sm">
                Breathing forms unlock at level 2.
            </div>
        )}
        
        {character.breathingForms.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400">
                <Wind className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No techniques learned yet.</p>
            </div>
        ) : (
            character.breathingForms.map((form, index) => {
                const formNumber = index + 1;
                const canFreeForm = isSlayer && character.level >= 2 && formNumber === 1 && isCombatActive && isMyTurn && !freeFormUsedThisTurn;
                const canBladeMemory = isSlayer && character.level >= 12 && isCombatActive && isMyTurn && !bladeMemoryUsedThisTurn;
                const bladeMemoryApplies = canBladeMemory && usedFormsThisCombat.has(form.id);
                const baseCost = isDemon ? 0 : getSlayerFormCost(character.level, formNumber, bladeMemoryApplies && !canFreeForm);
                const cost = canFreeForm ? 0 : baseCost;
                const canEditForm = !readOnly && canUseForms && (!form.isLocked || isDM);
                const canUseForm = !readOnly && canUseForms && (!form.isLocked || isDM);
                // Prepend Ordinal if not Demon (e.g., "1st Form: ...")
                // Only if name doesn't already start with it (simple heuristic)
                const displayName = (!isDemon && !form.name.match(/^\d+.. Form/)) 
                    ? `${getOrdinal(formNumber)} Form: ${form.name}`
                    : form.name;

                return (
                <div key={form.id} className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center group relative ${form.isLocked && !isDM ? 'grayscale opacity-75' : ''}`}>
                    {/* Locked Indicator */}
                    {form.isLocked && !isDM && (
                         <div className="absolute inset-0 z-10 bg-white/50 flex items-center justify-center rounded-xl pointer-events-none data-[admin-override=true]:pointer-events-auto">
                              <Lock size={24} className="text-gray-400 opacity-50" />
                         </div>
                    )}

                    {/* DM Lock Toggle */}
                    {isDM && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                const newForms = character.breathingForms.map(f => 
                                    f.id === form.id ? { ...f, isLocked: !f.isLocked } : f
                                );
                                onUpdate({ breathingForms: newForms });
                            }}
                            className={`mr-3 p-2 rounded-lg transition-colors z-20 ${form.isLocked ? 'bg-red-500 text-white shadow-red-200 shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                            title={form.isLocked ? "Unlock Form" : "Lock Form"}
                        >
                            <Lock size={16} />
                        </button>
                    )}

                    {/* Reordering Controls (Only visible when not ReadOnly) */}
                    {!readOnly && (!form.isLocked || isDM) && (
                        <div className="flex flex-col gap-1 mr-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={(e) => { e.stopPropagation(); moveForm(index, 'up'); }}
                                disabled={index === 0}
                                className={`text-gray-400 hover:text-slayer-orange ${index === 0 ? 'invisible' : ''}`}
                            >
                                <ArrowUp size={14} />
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); moveForm(index, 'down'); }}
                                disabled={index === character.breathingForms.length - 1}
                                className={`text-gray-400 hover:text-slayer-orange ${index === character.breathingForms.length - 1 ? 'invisible' : ''}`}
                            >
                                <ArrowDown size={14} />
                            </button>
                        </div>
                    )}

                    <div className={`flex-1 ${canEditForm ? 'cursor-pointer' : ''}`} onClick={() => canEditForm && setEditingForm(form)}>
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                {displayName}
                                {form.isLocked && <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Locked</span>}
                            </h4>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 uppercase">
                                {form.diceCount}d{form.diceFace}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1">{form.description}</p>
                    </div>

                    <div className="flex items-center gap-3 relative z-20">
                         <div className="text-center min-w-[30px]">
                            <span className="block text-[10px] text-gray-400 font-bold uppercase">Cost</span>
                            <span className="block font-bold text-cyan-600">{cost === 0 ? 'FREE' : cost}</span>
                            {bladeMemoryApplies && !canFreeForm && !isDemon && (
                                <span className="block text-[9px] text-gray-400 font-bold uppercase">Blade</span>
                            )}
                        </div>
                        <button 
                            onClick={() => canUseForm && handleTechniqueRoll(form, formNumber)}
                            disabled={!canUseForm}
                            className={`p-2.5 rounded-xl shadow-lg transition-all ${!canUseForm ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-900 text-white shadow-gray-200 active:scale-95'}`}
                        >
                            <Swords size={18} />
                        </button>
                    </div>
                </div>
            )})
        )}
      </div>

      {/* Editor Modal */}
      {editingForm && (
        <BreathingFormEditorModal 
            form={editingForm} 
            isDemon={isDemon}
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
            <h3 className="font-bold text-gray-800">Combat Actions</h3>
         </div>
         
         {/* Action Categories */}
         {/* Main Actions */}
         <div className="space-y-2 mb-4">
             <div className="flex justify-between items-center px-1">
                 <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Main Actions</h4>
                 {!readOnly && (
                     <button 
                         onClick={() => setEditingAction({ initialType: 'main' })} 
                         className="text-gray-400 hover:text-slayer-orange"
                     >
                         <Plus size={16} />
                     </button>
                 )}
             </div>

             {/* Standard Actions moved here */}
             <button 
                onClick={() => {
                    if (readOnly) return;
                    if (isCombatActive && !canUseAction('main')) {
                        showToast("No actions remaining!", "error");
                        return;
                    }
                
                // Determine roll mode
                const rollMode = getAttackRollMode();
                
                setActiveRoll({
                    label: "Unarmed Strike", 
                    modifier: attackRollModifier,
                    mode: rollMode,
                    isAttack: true
                });

                if (isCombatActive && isMyTurn) {
                    useAction('main');
                }
            }}
            disabled={readOnly}
            className={`w-full p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center ${readOnly ? 'bg-gray-50 opacity-50 cursor-not-allowed' : 'bg-white active:bg-gray-50'}`}
         >
            <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-lg">
                    <Zap size={18} className="text-gray-600"/>
                </div>
                <span className="font-bold text-sm text-gray-700">Unarmed Strike</span>
            </div>
                <span className="text-xs font-bold text-gray-400">1d4 + {strMod + damageRollModifier}</span>
         </button>

             {character.customActions?.filter(a => a.type === 'main').map(action => (
                 <CustomActionRow 
                    key={action.id} 
                    action={action} 
                    readOnly={readOnly}
                    onRoll={(a) => {
                        if (!a.rollMode || a.rollMode === 'utility') return;
                        if (isCombatActive && !canUseAction('main')) {
                            showToast("No actions remaining!", "error");
                            return;
                        }

                        if (a.rollMode === 'attack') {
                            setActiveRoll({
                                label: `${a.name} (Attack)`,
                                modifier: attackRollModifier,
                                mode: getAttackRollMode(),
                                isAttack: true,
                            });
                            if (isCombatActive && isMyTurn) {
                                useAction('main');
                            }
                            return;
                        }

                        setActiveRoll({
                            label: `${a.name} (Damage)`,
                            mode: 'normal',
                            modifier: damageRollModifier,
                            isDamage: true,
                            diceCount: a.diceCount || 1,
                            diceFace: a.diceFace || 6,
                        });
                        if (isCombatActive && isMyTurn) {
                            useAction('main');
                        }
                    }}
                    onEdit={(a) => !readOnly && setEditingAction({ action: a })}
                 />
             ))}
         </div>

         {/* Bonus Actions */}
         <div className="space-y-2 mb-4">
             <div className="flex justify-between items-center px-1">
                 <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Bonus Actions</h4>
                 {!readOnly && (
                     <button 
                         onClick={() => setEditingAction({ initialType: 'bonus' })} 
                         className="text-gray-400 hover:text-slayer-orange"
                     >
                         <Plus size={16} />
                     </button>
                 )}
             </div>
         
         {!isDemon && (
             <button 
                onClick={() => !readOnly && handleBreathRecovery()}
                disabled={readOnly}
                className={`w-full p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center ${readOnly ? 'bg-gray-50 opacity-50 cursor-not-allowed' : 'bg-white active:bg-gray-50'}`}
             >
                <div className="flex items-center gap-3">
                    <div className="bg-cyan-50 p-2 rounded-lg">
                        <Wind size={18} className="text-cyan-600"/>
                    </div>
                    <div className="text-left">
                        <span className="font-bold text-sm text-gray-700 block">Total Concentration Breathing</span>
                        <span className="text-xs text-gray-400">Restores all Breaths & Resets Overdraft</span>
                    </div>
                </div>
             </button>
         )}

         {character.customActions?.filter(a => a.type === 'bonus').map(action => (
                <CustomActionRow 
                key={action.id} 
                action={action} 
                readOnly={readOnly}
                onRoll={(a) => {
                    if (!a.rollMode || a.rollMode === 'utility') return;
                    if (isCombatActive && !canUseAction('bonus')) {
                        showToast("Bonus action already used!", "error");
                        return;
                    }
                    if (a.rollMode === 'attack') {
                        setActiveRoll({
                            label: `${a.name} (Attack)`,
                            modifier: attackMod + proficiency,
                            mode: getAttackRollMode(),
                            isAttack: true,
                        });
                        if (isCombatActive && isMyTurn) {
                            useAction('bonus');
                        }
                        return;
                    }
                    setActiveRoll({
                        label: `${a.name} (Damage)`,
                        mode: 'normal',
                        modifier: 0,
                        isDamage: true,
                        diceCount: a.diceCount || 1,
                        diceFace: a.diceFace || 6,
                    });
                    if (isCombatActive && isMyTurn) {
                        useAction('bonus');
                    }
                }}
                onEdit={(a) => !readOnly && setEditingAction({ action: a })}
                />
            ))}
      </div>

       {/* Reactions */}
       <div className="space-y-2 mb-4">
             <div className="flex justify-between items-center px-1">
                 <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Reactions</h4>
                 {!readOnly && (
                     <button 
                         onClick={() => setEditingAction({ initialType: 'reaction' })} 
                         className="text-gray-400 hover:text-slayer-orange"
                     >
                         <Plus size={16} />
                     </button>
                 )}
             </div>
             {character.customActions?.filter(a => a.type === 'reaction').length === 0 && (
                 <div className="text-center p-3 text-xs text-gray-300 italic">No reactions</div>
             )}
             {character.customActions?.filter(a => a.type === 'reaction').map(action => (
                 <CustomActionRow 
                    key={action.id} 
                    action={action} 
                    readOnly={readOnly}
                    onRoll={(a) => {
                        if (!a.rollMode || a.rollMode === 'utility') return;
                        if (a.rollMode === 'attack') {
                            setActiveRoll({
                                label: `${a.name} (Attack)`,
                                modifier: attackRollModifier,
                                mode: getAttackRollMode(),
                                isAttack: true,
                            });
                            return;
                        }
                        setActiveRoll({
                            label: `${a.name} (Damage)`,
                            mode: 'normal',
                            modifier: damageRollModifier,
                            isDamage: true,
                            diceCount: a.diceCount || 1,
                            diceFace: a.diceFace || 6,
                        });
                    }}
                    onEdit={(a) => !readOnly && setEditingAction({ action: a })}
                 />
             ))}
         </div>

         {/* Free Actions */}
         <div className="space-y-2 mb-4">
             <div className="flex justify-between items-center px-1">
                 <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Free Actions</h4>
                 {!readOnly && (
                     <button 
                         onClick={() => setEditingAction({ initialType: 'free' })} 
                         className="text-gray-400 hover:text-slayer-orange"
                     >
                         <Plus size={16} />
                     </button>
                 )}
             </div>
             {character.customActions?.filter(a => a.type === 'free').length === 0 && (
                 <div className="text-center p-3 text-xs text-gray-300 italic">No free actions</div>
             )}
             {character.customActions?.filter(a => a.type === 'free').map(action => (
                 <CustomActionRow 
                    key={action.id} 
                    action={action} 
                    readOnly={readOnly}
                    onRoll={(a) => {
                        if (!a.rollMode || a.rollMode === 'utility') return;
                        if (a.rollMode === 'attack') {
                            setActiveRoll({
                                label: `${a.name} (Attack)`,
                                modifier: attackRollModifier,
                                mode: getAttackRollMode(),
                                isAttack: true,
                            });
                            return;
                        }
                        setActiveRoll({
                            label: `${a.name} (Damage)`,
                            mode: 'normal',
                            modifier: damageRollModifier,
                            isDamage: true,
                            diceCount: a.diceCount || 1,
                            diceFace: a.diceFace || 6,
                        });
                    }}
                    onEdit={(a) => !readOnly && setEditingAction({ action: a })}
                 />
             ))}
         </div>
      </div>

      {editingAction && (
          <CombatActionEditorModal
             action={editingAction.action}
             initialType={editingAction.initialType}
             onSave={(updatedAction) => {
                 const current = character.customActions || [];
                 const exists = current.find(a => a.id === updatedAction.id);
                 let newActions;
                 if (exists) {
                     newActions = current.map(a => a.id === updatedAction.id ? updatedAction : a);
                 } else {
                     newActions = [...current, updatedAction];
                 }
                 onUpdate({ customActions: newActions });
                 setEditingAction(null);
             }}
             onDelete={(id) => {
                 const current = character.customActions || [];
                 onUpdate({ customActions: current.filter(a => a.id !== id) });
             }}
             onClose={() => setEditingAction(null)}
          />
      )}

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
                        onClick={() => {
                             setPendingHitConfirmForm(null);
                             if (isSlayer && character.level >= 6) {
                                 setFlowStateReady(true);
                             }
                        }}
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
            extraDice={activeRoll.extraDice}
            onComplete={handleRollComplete}
        />
      )}

      {/* Helper CustomActionRow was here */}
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

function CustomActionRow({ action, readOnly, onEdit, onRoll }: { action: CombatAction, readOnly?: boolean, onEdit: (a: CombatAction) => void, onRoll?: (a: CombatAction) => void }) {
    const icon = {
        main: Swords,
        bonus: Zap,
        reaction: Clock,
        free: ZapOff
    }[action.type] || Swords;

    const IconComp = icon;

    return (
        <div className={`w-full p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center group transition-colors text-left ${readOnly ? 'bg-gray-50 opacity-50' : 'bg-white hover:border-gray-200'}`}>
            <button className="flex items-center gap-3 text-left" onClick={() => onEdit(action)} disabled={readOnly}>
                <div className="bg-gray-50 p-2 rounded-lg text-gray-400 group-hover:text-slayer-orange transition-colors">
                    <IconComp size={18} />
                </div>
                <div>
                    <span className="font-bold text-sm text-gray-700 block">{action.name}</span>
                    <span className="text-xs text-gray-400 block line-clamp-1">{action.description}</span>
                    {action.rollMode && action.rollMode !== 'utility' && action.diceCount && action.diceFace && (
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide block mt-1">
                            {action.rollMode} • {action.diceCount}d{action.diceFace}
                        </span>
                    )}
                </div>
            </button>
            {action.rollMode && action.rollMode !== 'utility' && action.diceCount && action.diceFace && !readOnly && (
                <button
                    onClick={() => onRoll?.(action)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slayer-orange text-white font-bold hover:bg-orange-600 transition-colors"
                >
                    Roll
                </button>
            )}
            {(readOnly || !action.rollMode || action.rollMode === 'utility') && <div />}
        </div>
    );
}
