import { useState } from "react";
import { Heart, Plus, Minus } from "lucide-react";

interface Props {
  currentHP: number;
  maxHP: number;
  healingSurges: number;
  onUpdateHP: (newHP: number) => void;
  onUseSurge: () => void;
  onClose: () => void;
}

export function HealthPopup({ currentHP, maxHP, healingSurges, onUpdateHP, onUseSurge, onClose }: Props) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<'damage' | 'heal'>('damage');

  const handleApply = () => {
    const amount = parseInt(value);
    if (!amount) return;
    
    let newHP = currentHP;
    if (mode === 'damage') newHP = Math.max(0, currentHP - amount);
    else newHP = Math.min(maxHP, currentHP + amount);
    
    onUpdateHP(newHP);
    setValue("");
  };

  const numpad = [1,2,3,4,5,6,7,8,9,0];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 animate-slide-up sm:animate-scale-in">
        
        {/* Header Display */}
        <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-400 uppercase">Current HP</span>
                <span className={`text-4xl font-bold ${currentHP < maxHP/2 ? 'text-red-500' : 'text-gray-900'}`}>
                    {currentHP} <span className="text-lg text-gray-400">/ {maxHP}</span>
                </span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold p-2">✕</button>
        </div>

        {/* Input Display */}
        <div className={`flex items-center justify-between p-4 rounded-xl mb-4 ${mode === 'damage' ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
            <div className="flex gap-2">
                <button 
                  onClick={() => setMode('damage')}
                  className={`p-2 rounded-lg transition ${mode === 'damage' ? 'bg-red-500 text-white shadow-sm' : 'text-red-400 hover:bg-red-100'}`}
                >
                    <Minus size={20} />
                </button>
                <button 
                  onClick={() => setMode('heal')}
                  className={`p-2 rounded-lg transition ${mode === 'heal' ? 'bg-green-500 text-white shadow-sm' : 'text-green-600 hover:bg-green-100'}`}
                >
                    <Plus size={20} />
                </button>
            </div>
            <span className="text-3xl font-mono font-bold text-gray-800">
                {value || "0"}
            </span>
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 mb-6">
            {numpad.map(num => (
                <button 
                    key={num}
                    onClick={() => setValue(v => v.length < 3 ? v + num : v)}
                    className={`p-4 rounded-xl font-bold text-xl transition active:scale-95 ${num === 0 ? 'col-span-2 bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}`}
                >
                    {num}
                </button>
            ))}
            <button 
                onClick={() => setValue(v => v.slice(0, -1))} 
                className="bg-gray-100 text-gray-500 rounded-xl flex items-center justify-center p-4 hover:bg-gray-200"
            >
                ⌫
            </button>
        </div>

        {/* Actions */}
        <div className="space-y-3">
            <button 
                onClick={handleApply}
                disabled={!value}
                className={`w-full py-4 rounded-xl font-bold text-white transition shadow-sm active:scale-[0.98] ${mode === 'damage' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                {mode === 'damage' ? 'Apply Damage' : 'Apply Healing'}
            </button>
            
            <button 
                onClick={onUseSurge}
                disabled={healingSurges <= 0}
                className="w-full py-3 rounded-xl font-bold text-slayer-orange border border-orange-200 bg-orange-50 hover:bg-orange-100 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
                <Heart size={18} fill="currentColor" />
                Use Healing Surge ({healingSurges} left)
            </button>
        </div>
      </div>
    </div>
  );
}
