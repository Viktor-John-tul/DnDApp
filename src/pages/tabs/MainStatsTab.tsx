import { useState } from "react";
import { Shield, Zap, Wind, PersonStanding, Star } from "lucide-react";
import type { RPGCharacter } from "../../types";
import { Calculator, resolveEquippedSpecialItemBonuses } from "../../services/rules";
import { AttributeCard } from "../../components/AttributeCard";
import { SkillRow } from "../../components/SkillRow";
import { DiceRollerOverlay } from "../../components/DiceRollerOverlay";
import { getSlayerBaseSpeed, isSlayerCharacter } from "../../services/slayerProgression";
import type { RollMode } from "../../services/rules";

const ALL_SKILLS = [
  "Acrobatics (Dex)", "Animal Handling (Wis)", "Arcana (Int)", "Athletics (Str)",
  "Deception (Cha)", "History (Int)", "Insight (Wis)", "Intimidation (Cha)",
  "Investigation (Int)", "Medicine (Wis)", "Nature (Int)", "Perception (Wis)",
  "Performance (Cha)", "Persuasion (Cha)", "Religion (Int)", "Sleight of Hand (Dex)",
  "Stealth (Dex)", "Survival (Wis)"
];

interface Props {
  character: RPGCharacter;
  onUpdate: (updates: Partial<RPGCharacter>) => void;
  readOnly?: boolean;
  onRollLogged?: (purpose: string, notation: string, total: number) => void;
}

export function MainStatsTab({ character, onUpdate, readOnly, onRollLogged }: Props) {
  const [activeRoll, setActiveRoll] = useState<{
        label: string; 
        modifier: number; 
        mode: RollMode;
        diceCount?: number;
        diceFace?: number;
    } | null>(null);

  const itemBonuses = resolveEquippedSpecialItemBonuses(character.inventory || []);
  const effectiveStrength = character.strength + itemBonuses.attributeBonuses.strength;
  const effectiveDexterity = character.dexterity + itemBonuses.attributeBonuses.dexterity;
  const effectiveConstitution = character.constitution + itemBonuses.attributeBonuses.constitution;
  const effectiveIntelligence = character.intelligence + itemBonuses.attributeBonuses.intelligence;
  const effectiveWisdom = character.wisdom + itemBonuses.attributeBonuses.wisdom;
  const effectiveCharisma = character.charisma + itemBonuses.attributeBonuses.charisma;

  const currentLoad = Calculator.getCurrentLoad(character.inventory || []);
  const maxLoad = character.type === 'demon'
    ? Number.POSITIVE_INFINITY
    : Calculator.getMaxLoad(effectiveStrength) + itemBonuses.carryCapacityBonus;
  const isEncumbered = character.type === 'demon' ? false : currentLoad > maxLoad;
  const isSlayer = isSlayerCharacter(character);
  const proficiency = character.customProficiency ?? Calculator.getProficiencyBonus(character.level);
  const maxHP = Math.max(1, (character.customMaxHP ?? Calculator.getMaxHP(effectiveConstitution, character.level)) + itemBonuses.maxHPBonus);
  const baseAC = (character.customAC ?? Calculator.getAC(effectiveDexterity)) + itemBonuses.acBonus;
  const acBonus = isSlayer && character.level >= 14 && character.currentHP < maxHP * 0.5 ? 1 : 0;
  const ac = baseAC + acBonus;
  const initiative = (character.customInitiative ?? Calculator.getModifier(effectiveDexterity)) + itemBonuses.initiativeBonus;
  const baseSpeed = isSlayer ? getSlayerBaseSpeed(character.level) : 30;
  const speed = (character.customSpeed ?? Calculator.getSpeed(isEncumbered, baseSpeed)) + itemBonuses.speedBonus;

  const getCheckBonus = (ability: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA') => itemBonuses.checkBonuses[ability] ?? itemBonuses.checkBonuses.all ?? 0;
  const getSaveBonus = (ability: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA') => itemBonuses.saveBonuses[ability] ?? itemBonuses.saveBonuses.all ?? 0;
  const getSkillBonus = (skill: string) => itemBonuses.skillBonuses[skill.toLowerCase()] ?? itemBonuses.skillBonuses.all ?? 0;
  const getRollAdvantage = (mode: 'check' | 'save' | 'skill' | 'attack' | 'damage' | 'initiative', abilityOrSkill?: string) => {
    if (mode === 'attack') return itemBonuses.attackAdvantage;
    if (mode === 'damage') return itemBonuses.damageAdvantage;
    if (mode === 'initiative') return itemBonuses.initiativeAdvantage;
    if (mode === 'check') {
      const key = (abilityOrSkill || 'all') as 'all' | 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
      return Boolean(itemBonuses.checkAdvantage[key] || itemBonuses.checkAdvantage.all);
    }
    if (mode === 'save') {
      const key = (abilityOrSkill || 'all') as 'all' | 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
      return Boolean(itemBonuses.saveAdvantage[key] || itemBonuses.saveAdvantage.all);
    }
    const normalizedSkill = (abilityOrSkill || 'all').toLowerCase();
    return Boolean(itemBonuses.skillAdvantage[normalizedSkill] || itemBonuses.skillAdvantage.all);
  };

  // Handlers
  const handleRoll = (label: string, modifier: number, requiresDisadvantage = false, requiresAdvantage = false) => {
    if (readOnly) return;
    
    // Check Status Effects
    const hasEffectAdvantage = character.statusEffects?.some(e => e.type === 'advantage');
    const hasEffectDisadvantage = character.statusEffects?.some(e => e.type === 'disadvantage');

    const hasAdv = requiresAdvantage || hasEffectAdvantage;
    const hasDis = requiresDisadvantage || hasEffectDisadvantage;
    
    let mode: RollMode = 'normal';
    if(hasAdv && !hasDis) mode = 'advantage';
    else if(!hasAdv && hasDis) mode = 'disadvantage';

    setActiveRoll({
      label,
      modifier,
      mode
    });
  };

  return (
    <div className="space-y-6 lg:space-y-8 pb-20">
      {/* Vitals Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
        <VitalCard icon={<Shield size={16}/>} label="AC" value={ac} color="text-blue-600" bg="bg-blue-50" />
        <VitalCard icon={<Zap size={16}/>} label="Init" value={initiative >= 0 ? `+${initiative}` : initiative} color="text-yellow-600" bg="bg-yellow-50" />
        <VitalCard icon={<PersonStanding size={16}/>} label="Speed" value={`${speed}ft`} color={isEncumbered ? "text-red-500" : "text-green-600"} bg={isEncumbered ? "bg-red-50" : "bg-green-50"} />
        <VitalCard icon={<Star size={16}/>} label="Prof" value={`+${proficiency}`} color="text-purple-600 dark:text-purple-300" bg="bg-purple-50 dark:bg-purple-900/30" />
      </div>

      {/* Conditions */}
      <div className="flex flex-wrap gap-2">
        {character.type !== 'demon' && (
            <ConditionBadge label={character.breathingStyleName || "Breathing Style"} active color="orange" icon={<Wind size={12}/>} />
        )}
        {isEncumbered && <ConditionBadge label="Encumbered" active color="red" icon={<PersonStanding size={12}/>} />}
        {character.statusEffects?.map(e => (
             <ConditionBadge key={e.id} label={e.name} active color={e.type === 'condition' ? 'blue' : 'orange'} icon={<Zap size={12}/>} />
        ))}
      </div>

      {/* Attributes Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <AttributeCard 
          title="STR" score={effectiveStrength}
          onCheck={() => handleRoll("STR Check", Calculator.getModifier(effectiveStrength) + getCheckBonus("STR"), false, getRollAdvantage('check', 'STR'))} 
          onSave={() => handleRoll("STR Save", Calculator.getModifier(effectiveStrength) + (character.proficientSavingThrows.includes("STR") ? proficiency : 0) + getSaveBonus("STR"), false, getRollAdvantage('save', 'STR'))}
        />
        <AttributeCard 
          title="DEX" score={effectiveDexterity}
          onCheck={() => handleRoll("DEX Check", Calculator.getModifier(effectiveDexterity) + getCheckBonus("DEX"), isEncumbered, getRollAdvantage('check', 'DEX'))} 
          onSave={() => handleRoll("DEX Save", Calculator.getModifier(effectiveDexterity) + (character.proficientSavingThrows.includes("DEX") ? proficiency : 0) + getSaveBonus("DEX"), isEncumbered, getRollAdvantage('save', 'DEX'))}
        />
        <AttributeCard 
          title="CON" score={effectiveConstitution}
          onCheck={() => handleRoll("CON Check", Calculator.getModifier(effectiveConstitution) + getCheckBonus("CON"), false, getRollAdvantage('check', 'CON'))} 
          onSave={() => handleRoll("CON Save", Calculator.getModifier(effectiveConstitution) + (character.proficientSavingThrows.includes("CON") ? proficiency : 0) + getSaveBonus("CON"), false, getRollAdvantage('save', 'CON'))}
        />
        <AttributeCard 
          title="INT" score={effectiveIntelligence}
          onCheck={() => handleRoll("INT Check", Calculator.getModifier(effectiveIntelligence) + getCheckBonus("INT"), false, getRollAdvantage('check', 'INT'))} 
          onSave={() => handleRoll("INT Save", Calculator.getModifier(effectiveIntelligence) + (character.proficientSavingThrows.includes("INT") ? proficiency : 0) + getSaveBonus("INT"), false, getRollAdvantage('save', 'INT'))}
        />
        <AttributeCard 
          title="WIS" score={effectiveWisdom}
          onCheck={() => handleRoll("WIS Check", Calculator.getModifier(effectiveWisdom) + getCheckBonus("WIS"), false, getRollAdvantage('check', 'WIS'))} 
          onSave={() => handleRoll("WIS Save", Calculator.getModifier(effectiveWisdom) + (character.proficientSavingThrows.includes("WIS") ? proficiency : 0) + getSaveBonus("WIS"), false, getRollAdvantage('save', 'WIS'))}
        />
        <AttributeCard 
          title="CHA" score={effectiveCharisma}
          onCheck={() => handleRoll("CHA Check", Calculator.getModifier(effectiveCharisma) + getCheckBonus("CHA"), false, getRollAdvantage('check', 'CHA'))} 
          onSave={() => handleRoll("CHA Save", Calculator.getModifier(effectiveCharisma) + (character.proficientSavingThrows.includes("CHA") ? proficiency : 0) + getSaveBonus("CHA"), false, getRollAdvantage('save', 'CHA'))}
        />
      </div>

      {/* Skills List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-700">Skills</h3>
            <span className="text-xs text-gray-400 font-medium uppercase">Bonus</span>
        </div>
        <div className="divide-y divide-gray-100">
            {ALL_SKILLS.map(skill => (
                <SkillRow 
                    key={skill}
                    skill={skill}
                    stats={{str: effectiveStrength, dex: effectiveDexterity, con: effectiveConstitution, int: effectiveIntelligence, wis: effectiveWisdom, cha: effectiveCharisma}}
                    proficiencyBonus={proficiency}
                    isProficient={character.proficientSkills.includes(skill)}
                    isEncumbered={isEncumbered}
                    onRoll={() => handleRoll(
                        skill.split("(")[0].trim(), 
                      Calculator.getSkillBonus(skill, {str: effectiveStrength, dex: effectiveDexterity, con: effectiveConstitution, int: effectiveIntelligence, wis: effectiveWisdom, cha: effectiveCharisma}, proficiency, character.proficientSkills.includes(skill)) + getSkillBonus(skill),
                      Calculator.hasEncumbranceDisadvantage(skill, isEncumbered),
                      getRollAdvantage('skill', skill)
                    )}
                />
            ))}
        </div>
      </div>

      {activeRoll && (
        <DiceRollerOverlay 
            mode={activeRoll.mode} 
            modifier={activeRoll.modifier} 
            label={activeRoll.label} 
            diceCount={activeRoll.diceCount}
            diceFace={activeRoll.diceFace}
            onComplete={(total) => {
             if (total !== undefined) {
               const notation = activeRoll.diceCount && activeRoll.diceFace
                ? `${activeRoll.diceCount}d${activeRoll.diceFace}`
                : activeRoll.mode === "advantage"
                  ? "2d20 (Advantage)"
                  : activeRoll.mode === "disadvantage"
                    ? "2d20 (Disadvantage)"
                    : "1d20";
               onRollLogged?.(activeRoll.label, notation, total);
             }

                 // Consume One-Time Effects
                 const hasOneTime = character.statusEffects?.some(e => e.type === 'advantage' || e.type === 'disadvantage');
                 if (hasOneTime) {
                     onUpdate({ statusEffects: (character.statusEffects || []).filter(e => e.type !== 'advantage' && e.type !== 'disadvantage') });
                 }
                 setActiveRoll(null);
            }} 
        />
      )}
    </div>
  );
}

// Sub-components
function VitalCard({ icon, label, value, color, bg }: any) {
    return (
        <div className={`flex flex-col items-center p-3 rounded-xl ${bg} ${color}`}>
            {icon}
            <span className="text-[10px] font-bold uppercase mt-1 opacity-70">{label}</span>
            <span className="text-lg font-black leading-none mt-1">{value}</span>
        </div>
    );
}

function ConditionBadge({ label, active, color, icon }: any) {
    if (!active) return null;
    const colors: any = {
        orange: 'bg-orange-100 text-orange-700 border-orange-200',
        red: 'bg-red-100 text-red-700 border-red-200',
        blue: 'bg-blue-100 text-blue-700 border-blue-200'
    };
    return (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${colors[color]}`}>
            {icon}
            {label}
        </div>
    );
}
