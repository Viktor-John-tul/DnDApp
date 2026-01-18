import { Plus, Minus } from "lucide-react";

interface Props {
  title: string;
  value: number;
  pointsRemaining: number;
  onChange: (newValue: number) => void;
}

export function StatStepper({ title, value, pointsRemaining, onChange }: Props) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-4 h-36">
      <span className="font-bold text-gray-500 uppercase text-sm">{title}</span>
      <span className={`text-4xl font-bold ${value > 10 ? 'text-slayer-cyan' : 'text-gray-900'}`}>
        {value}
      </span>
      
      <div className="flex items-center gap-4 mt-auto">
        <button 
          onClick={() => onChange(value - 1)}
          disabled={value <= 10}
          className="w-8 h-8 rounded-full flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed bg-red-100 text-red-600 hover:bg-red-200"
        >
          <Minus size={14} strokeWidth={3} />
        </button>
        
        <button 
          onClick={() => onChange(value + 1)}
          disabled={pointsRemaining <= 0}
          className="w-8 h-8 rounded-full flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed bg-green-100 text-green-600 hover:bg-green-200"
        >
          <Plus size={14} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
