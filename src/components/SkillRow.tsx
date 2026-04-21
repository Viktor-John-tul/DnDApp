import { Calculator } from "../services/rules";

interface Props {
  skill: string;
  stats: any;
  proficiencyBonus: number;
  isProficient: boolean;
  isEncumbered: boolean;
  onRoll: () => void;
}

export function SkillRow({ skill, stats, proficiencyBonus, isProficient, isEncumbered, onRoll }: Props) {
  const bonus = Calculator.getSkillBonus(skill, stats, proficiencyBonus, isProficient);
  const hasDisadvantage = Calculator.hasEncumbranceDisadvantage(skill, isEncumbered);
  const [name, attr] = skill.split(" (");

  return (
    <button 
      onClick={onRoll}
      className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition border border-transparent hover:border-gray-200 ${hasDisadvantage ? 'bg-red-50/50' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${isProficient ? 'bg-slayer-orange' : 'bg-gray-200'}`} />
        <div className="text-left">
          <span className={`block text-sm ${isProficient ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
            {name}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">({attr}</span>
            {hasDisadvantage && (
              <span className="text-[10px] font-bold text-red-500 bg-red-100 px-1 rounded">DIS</span>
            )}
          </div>
        </div>
      </div>
      
      <span className="font-bold text-gray-700 font-mono text-lg">
        {bonus >= 0 ? '+' : ''}{bonus}
      </span>
    </button>
  );
}
