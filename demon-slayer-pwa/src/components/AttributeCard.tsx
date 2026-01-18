import { Calculator } from "../services/rules";

interface Props {
  title: string;
  score: number;
  onCheck: () => void;
  onSave: () => void;
  isProficientStart?: boolean; 
}

export function AttributeCard({ title, score, onCheck, onSave }: Props) {
  const mod = Calculator.getModifier(score);
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
      <div className="bg-gray-50 p-2 text-center border-b border-gray-100">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{title}</span>
        <div className="text-xl font-bold text-gray-900">{score}</div>
      </div>
      
      <div className="flex-1 flex divide-x divide-gray-100">
        <button 
          onClick={onCheck}
          className="flex-1 p-2 hover:bg-gray-50 active:bg-orange-50 transition flex flex-col items-center justify-center gap-1 group"
        >
          <span className="text-[10px] text-gray-400 font-bold group-hover:text-slayer-orange">CHECK</span>
          <span className="text-lg font-bold text-gray-700">
            {mod >= 0 ? '+' : ''}{mod}
          </span>
        </button>
        
        <button 
          onClick={onSave}
          className="flex-1 p-2 hover:bg-gray-50 active:bg-orange-50 transition flex flex-col items-center justify-center gap-1 group"
        >
          <span className="text-[10px] text-gray-400 font-bold group-hover:text-slayer-orange">SAVE</span>
          {/* Note: Save proficiency logic is character level, handled by caller via roll modifier usually, 
              but UI usually shows just basic mod unless we pass in save bonus. 
              The Swift app shows just "+Mod" unless proficient. 
              For now let's just show basic mod trigger and let logic handle the math on roll. */}
          <span className="text-lg font-bold text-gray-700">
            {mod >= 0 ? '+' : ''}{mod}
          </span>
        </button>
      </div>
    </div>
  );
}
