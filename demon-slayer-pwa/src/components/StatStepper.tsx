import { Plus, Minus } from "lucide-react";

interface Props {
  title: string;
  value: number;
  pointsRemaining?: number;
  onChange: (newValue: number) => void;
  max?: number;
  color?: string;
}

export function StatStepper({ title, value, pointsRemaining, onChange, max = 20, color = 'cyan' }: Props) {
  const isCapped = value >= max;
  const hasPoints = pointsRemaining !== undefined ? pointsRemaining > 0 : true;
  const minVal = pointsRemaining !== undefined ? 10 : 1;
  const textColor = color === 'red' ? 'text-red-600' : 'text-slayer-cyan';
  
  const minusBtnClass = "w-8 h-8 rounded-full flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed bg-gray-100 text-gray-600 hover:bg-gray-200";
  const plusBtnClass = color === 'red' 
      ? "w-8 h-8 rounded-full flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed bg-red-100 text-red-600 hover:bg-red-200"
      : "w-8 h-8 rounded-full flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed bg-green-100 text-green-600 hover:bg-green-200";

  return (
    <div className={`bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-3 sm:gap-4 min-h-32 sm:min-h-36 ${color === 'red' ? 'border-red-100/50' : ''}`}>
      <span className="font-bold text-gray-500 uppercase text-sm">{title}</span>
      <span className={`text-3xl sm:text-4xl font-bold ${value > 10 ? textColor : 'text-gray-900'}`}>
        {value}
      </span>
      
      <div className="flex items-center gap-4 mt-auto">
        <button 
          onClick={() => onChange(value - 1)}
          disabled={value <= minVal}
          className={minusBtnClass}
        >
          <Minus size={14} strokeWidth={3} />
        </button>
        
        <button 
          onClick={() => onChange(value + 1)}
          disabled={isCapped || !hasPoints}
          className={plusBtnClass}
        >
          <Plus size={14} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
