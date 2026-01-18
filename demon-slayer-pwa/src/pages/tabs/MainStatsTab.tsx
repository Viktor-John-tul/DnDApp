import { useState } from "react";
import { Shield, Zap, Wind, PersonStanding, Star, Heart } from "lucide-react";
import type { RPGCharacter } from "../../types";
import { Calculator } from "../../services/rules";
import { AttributeCard } from "../../components/AttributeCard";
import { SkillRow } from "../../components/SkillRow";
import { HealthPopup } from "../../components/HealthPopup";
import { DiceRollerOverlay } from "../../components/DiceRollerOverlay";
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
}

export function MainStatsTab({ character, onUpdate, readOnly }: Props) {
  const [showHealth, setShowHealth] = useState(false);
  const [activeRoll, setActiveRoll] = useState<{label: string, modifier: number, mode: RollMode} | null>(null);

  const isEncumbered = character.type === 'demon' ? false : Calculator.isEncumbered(character.strength, character.inventory);
  const proficiency = character.customProficiency ?? Calculator.getProficiencyBonus(character.level);
  const ac = character.customAC ?? Calculator.getAC(character.dexterity);
  const initiative = character.customInitiative ?? Calculator.getModifier(character.dexterity);
  const speed = character.customSpeed ?? Calculator.getSpeed(isEncumbered);
  const maxHP = character.customMaxHP ?? Calculator.getMaxHP(character.constitution, character.level);

  // Handlers
  const handleRoll = (label: string, modifier: number, requiresDisadvantage = false) => {
    if (readOnly) return;
    
    // Check Status Effects
    const hasEffectAdvantage = character.statusEffects?.some(e => e.type === 'advantage');
    const hasEffectDisadvantage = character.statusEffects?.some(e => e.type === 'disadvantage');

    const hasAdv = hasEffectAdvantage;
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

  const handleSurge = () => {
    if (readOnly || character.healingSurges <= 0) return;
    
    // Roll d12 + Con Mod (min 1)
    const surgeRoll = Math.floor(Math.random() * 12) + 1;
    const conMod = Calculator.getModifier(character.constitution);
    const healAmount = Math.max(1, surgeRoll + conMod);
    
    const newHP = Math.min(maxHP, character.currentHP + healAmount);
    
    onUpdate({
        healingSurges: character.healingSurges - 1,
        currentHP: newHP
    });
    
    // Maybe show a quick toast or alert about the surge here?
    // For now simple update logic.
    setShowHealth(false);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Vitals Row */}
      <div className="grid grid-cols-4 gap-2">
        <VitalCard icon={<Shield size={16}/>} label="AC" value={ac} color="text-blue-600" bg="bg-blue-50" />
        <VitalCard icon={<Zap size={16}/>} label="Init" value={initiative >= 0 ? `+${initiative}` : initiative} color="text-yellow-600" bg="bg-yellow-50" />
        <VitalCard icon={<PersonStanding size={16}/>} label="Speed" value={`${speed}ft`} color={isEncumbered ? "text-red-500" : "text-green-600"} bg={isEncumbered ? "bg-red-50" : "bg-green-50"} />
        <VitalCard icon={<Star size={16}/>} label="Prof" value={`+${proficiency}`} color="text-purple-600" bg="bg-purple-50" />
      </div>

      {/* Conditions */}
      <div className="flex flex-wrap gap-2">
        <ConditionBadge label={character.breathingStyleName || "Breathing Style"} active color="orange" icon={<Wind size={12}/>} />
        {isEncumbered && <ConditionBadge label="Encumbered" active color="red" icon={<PersonStanding size={12}/>} />}
        {character.statusEffects?.map(e => (
             <ConditionBadge key={e.id} label={e.name} active color={e.type === 'condition' ? 'blue' : 'orange'} icon={<Zap size={12}/>} />
        ))}
      </div>

      {/* Attributes Grid */}
      <div className="grid grid-cols-3 gap-3">
        <AttributeCard 
            title="STR" score={character.strength}
            onCheck={() => handleRoll("STR Check", Calculator.getModifier(character.strength))} 
            onSave={() => handleRoll("STR Save", Calculator.getModifier(character.strength) + (character.proficientSavingThrows.includes("STR") ? proficiency : 0))}
        />
        <AttributeCard 
            title="DEX" score={character.dexterity}
            onCheck={() => handleRoll("DEX Check", Calculator.getModifier(character.dexterity), isEncumbered)} 
            onSave={() => handleRoll("DEX Save", Calculator.getModifier(character.dexterity) + (character.proficientSavingThrows.includes("DEX") ? proficiency : 0), isEncumbered)}
        />
        <AttributeCard 
            title="CON" score={character.constitution}
            onCheck={() => handleRoll("CON Check", Calculator.getModifier(character.constitution))} 
            onSave={() => handleRoll("CON Save", Calculator.getModifier(character.constitution) + (character.proficientSavingThrows.includes("CON") ? proficiency : 0))}
        />
        <AttributeCard 
            title="INT" score={character.intelligence}
            onCheck={() => handleRoll("INT Check", Calculator.getModifier(character.intelligence))} 
            onSave={() => handleRoll("INT Save", Calculator.getModifier(character.intelligence) + (character.proficientSavingThrows.includes("INT") ? proficiency : 0))}
        />
        <AttributeCard 
            title="WIS" score={character.wisdom}
            onCheck={() => handleRoll("WIS Check", Calculator.getModifier(character.wisdom))} 
            onSave={() => handleRoll("WIS Save", Calculator.getModifier(character.wisdom) + (character.proficientSavingThrows.includes("WIS") ? proficiency : 0))}
        />
        <AttributeCard 
            title="CHA" score={character.charisma}
            onCheck={() => handleRoll("CHA Check", Calculator.getModifier(character.charisma))} 
            onSave={() => handleRoll("CHA Save", Calculator.getModifier(character.charisma) + (character.proficientSavingThrows.includes("CHA") ? proficiency : 0))}
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
                    stats={{str: character.strength, dex: character.dexterity, con: character.constitution, int: character.intelligence, wis: character.wisdom, cha: character.charisma}}
                    proficiencyBonus={proficiency}
                    isProficient={character.proficientSkills.includes(skill)}
                    isEncumbered={isEncumbered}
                    onRoll={() => handleRoll(
                        skill.split("(")[0].trim(), 
                        Calculator.getSkillBonus(skill, {str: character.strength, dex: character.dexterity, con: character.constitution, int: character.intelligence, wis: character.wisdom, cha: character.charisma}, proficiency, character.proficientSkills.includes(skill)),
                        Calculator.hasEncumbranceDisadvantage(skill, isEncumbered)
                    )}
                />
            ))}
        </div>
      </div>

      {/* Floating Buttons: Health */}
      {!readOnly && (
      <div className="fixed bottom-24 right-4 z-40">
        <button 
            onClick={() => setShowHealth(true)}
            className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 hover:scale-105 transition active:scale-95"
        >
            <Heart size={24} fill="currentColor" />
            <span className="text-[10px] font-bold mt-0.5">{character.currentHP}/{maxHP}</span>
        </button>
      </div>
      )}

      {/* Modals */}
      {showHealth && (
        <HealthPopup 
            currentHP={character.currentHP} 
            maxHP={maxHP} 
            healingSurges={character.healingSurges} 
            onUpdateHP={(hp) => onUpdate({ currentHP: hp })}
            onUseSurge={handleSurge}
            onClose={() => setShowHealth(false)}
        />
      )}

      {activeRoll && (
        <DiceRollerOverlay 
            mode={activeRoll.mode} 
            modifier={activeRoll.modifier} 
            label={activeRoll.label} 
            onComplete={() => {
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
