import React from "react";
import { Shield, Sword, Zap, CheckSquare, Square, Heart } from 'lucide-react';
import type { BreathingForm, FormEffectType } from "../types";

interface Props {
  form: BreathingForm;
  onSave: (form: BreathingForm) => void;
  onClose: () => void;
  isDemon?: boolean;
}

const EFFECT_TYPES: { value: FormEffectType; label: string; icon: any }[] = [
  { value: 'damage', label: 'Damage', icon: Sword },
  { value: 'attackBuff', label: 'Attack Buff', icon: Zap },
  { value: 'advantageBuff', label: 'Advantage', icon: Shield },
  { value: 'heal', label: 'Heal Self', icon: Heart },
];

export function BreathingFormEditorModal({ form: initialForm, onSave, onClose, isDemon = false }: Props) {
  const [form, setForm] = React.useState<BreathingForm>(initialForm);

  // Filter effect types based on Demon status
  const visibleEffectTypes = isDemon 
      ? EFFECT_TYPES 
      : EFFECT_TYPES.filter(t => t.value !== 'heal');

  const handleDone = () => {
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="font-bold text-lg text-gray-800">Edit Technique</h2>
          <button 
            onClick={handleDone}
            className="text-slayer-orange font-bold hover:opacity-80"
          >
            Done
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Form Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Form Name</label>
              <input 
                type="text" 
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
                placeholder="e.g. 1st Form: Water Slice"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slayer-orange focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea 
                value={form.description}
                onChange={(e) => setForm({...form, description: e.target.value})}
                placeholder="Describe the move..."
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slayer-orange focus:border-transparent outline-none"
              />
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer" onClick={() => setForm({...form, requiresAttackRoll: !form.requiresAttackRoll})}>
               <div className={`p-1 rounded ${form.requiresAttackRoll ? 'text-slayer-orange' : 'text-gray-400'}`}>
                   {form.requiresAttackRoll ? <CheckSquare size={20} /> : <Square size={20} />}
               </div>
               <div className="flex-1">
                   <h4 className="font-bold text-sm text-gray-800">Requires Attack Roll</h4>
                   <p className="text-xs text-gray-500">Uncheck for auto-hit / buff only</p>
               </div>
            </div>
            
            {/* SP Cost Field - Implicitly asked for "creation" capabilities, cost is usually needed. keeping it. */}
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SP Cost</label>
              <input 
                 type="number"
                 value={(!isDemon) ? ("(Order Based)") : form.spCost}
                 disabled={!isDemon}
                 onChange={(e) => setForm({ ...form, spCost: parseInt(e.target.value) || 0 })}
                 className={`w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slayer-orange outline-none ${!isDemon ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                 placeholder={!isDemon ? "Calculated automatically" : "Enter Cost"}
              />
              {!isDemon && <p className="text-[10px] text-gray-400 mt-1">Cost follows progression table (1st: 8, 2nd: 12, 3rd: 16, ...)</p>}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Mechanics */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Effect Mechanics</h3>
            
            <div className={`grid ${visibleEffectTypes.length > 3 ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
              {visibleEffectTypes.map(type => (
                <button
                  key={type.value}
                  onClick={() => setForm({...form, effectType: type.value})}
                  className={`p-3 rounded-xl flex flex-col items-center gap-2 border transition-all ${
                    form.effectType === type.value
                      ? 'bg-orange-50 border-orange-200 text-slayer-orange ring-1 ring-orange-200' 
                      : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <type.icon size={20} />
                  <span className="text-xs font-bold text-center leading-tight">{type.label}</span>
                </button>
              ))}
            </div>

            {/* Dynamic Fields */}
            <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                {form.effectType === 'damage' && (
                    <>
                        <p className="text-xs font-bold text-gray-500 mb-2">Damage Dice</p>
                        <div className="flex gap-2">
                             <div className="flex-1">
                                <label className="text-[10px] uppercase font-bold text-gray-400">Count</label>
                                <input 
                                    type="number" value={form.diceCount} 
                                    onChange={e => setForm({...form, diceCount: Math.max(1, parseInt(e.target.value)||1)})}
                                    className="w-full p-2 bg-white border border-gray-200 rounded-lg text-center font-bold"
                                />
                             </div>
                             <div className="flex items-end pb-2 font-bold text-gray-400">d</div>
                             <div className="flex-1">
                                <label className="text-[10px] uppercase font-bold text-gray-400">Face</label>
                                <select 
                                    value={form.diceFace}
                                    onChange={e => setForm({...form, diceFace: parseInt(e.target.value)})}
                                    className="w-full p-2 bg-white border border-gray-200 rounded-lg text-center font-bold appearance-none"
                                >
                                    <option value="4">4</option>
                                    <option value="6">6</option>
                                    <option value="8">8</option>
                                    <option value="10">10</option>
                                    <option value="12">12</option>
                                    <option value="20">20</option>
                                </select>
                             </div>
                        </div>
                    </>
                )}

                {form.effectType === 'attackBuff' && (
                    <>
                         <p className="text-xs font-bold text-gray-500 mb-2">Bonus Damage Dice Effect</p>
                         <p className="text-xs text-gray-400 mb-2">Increases damage rolls by:</p>
                         <div className="flex gap-2">
                             <div className="flex-1">
                                <label className="text-[10px] uppercase font-bold text-gray-400">Count</label>
                                <input 
                                    type="number" value={form.diceCount} 
                                    onChange={e => setForm({...form, diceCount: Math.max(1, parseInt(e.target.value)||1)})}
                                    className="w-full p-2 bg-white border border-gray-200 rounded-lg text-center font-bold"
                                />
                             </div>
                             <div className="flex items-end pb-2 font-bold text-gray-400">d</div>
                             <div className="flex-1">
                                <label className="text-[10px] uppercase font-bold text-gray-400">Face</label>
                                <select 
                                    value={form.diceFace}
                                    onChange={e => setForm({...form, diceFace: parseInt(e.target.value)})}
                                    className="w-full p-2 bg-white border border-gray-200 rounded-lg text-center font-bold appearance-none"
                                >
                                    <option value="4">4</option>
                                    <option value="6">6</option>
                                    <option value="8">8</option>
                                    <option value="10">10</option>
                                    <option value="12">12</option>
                                    <option value="20">20</option>
                                </select>
                             </div>
                        </div>
                        <div className="mt-2">
                             <label className="text-[10px] uppercase font-bold text-gray-400">Duration (Rounds)</label>
                             <input 
                                type="number" value={form.durationRounds} 
                                onChange={e => setForm({...form, durationRounds: parseInt(e.target.value)||0})}
                                className="w-full p-2 bg-white border border-gray-200 rounded-lg font-bold"
                            />
                        </div>
                    </>
                )}

                {form.effectType === 'advantageBuff' && (
                    <>
                        <p className="text-xs font-bold text-gray-500 mb-2">Advantage Effect</p>
                        <p className="text-xs text-gray-400 mb-2">Grants Advantage on attacks for duration.</p>
                         <div>
                             <label className="text-[10px] uppercase font-bold text-gray-400">Duration (Rounds)</label>
                             <input 
                                type="number" value={form.durationRounds} 
                                onChange={e => setForm({...form, durationRounds: Math.max(1, parseInt(e.target.value)||1)})}
                                className="w-full p-2 bg-white border border-gray-200 rounded-lg font-bold"
                            />
                        </div>
                    </>
                )}

                {form.effectType === 'heal' && (
                    <>
                         <p className="text-xs font-bold text-gray-500 mb-2">Regeneration Effect</p>
                         <p className="text-xs text-gray-400 mb-2">Heals HP at start of turn for duration.</p>
                         <div className="flex gap-2">
                             <div className="flex-1">
                                <label className="text-[10px] uppercase font-bold text-gray-400">Count</label>
                                <input 
                                    type="number" value={form.diceCount} 
                                    onChange={e => setForm({...form, diceCount: Math.max(1, parseInt(e.target.value)||1)})}
                                    className="w-full p-2 bg-white border border-gray-200 rounded-lg text-center font-bold"
                                />
                             </div>
                             <div className="flex items-end pb-2 font-bold text-gray-400">d</div>
                             <div className="flex-1">
                                <label className="text-[10px] uppercase font-bold text-gray-400">Face</label>
                                <select 
                                    value={form.diceFace}
                                    onChange={e => setForm({...form, diceFace: parseInt(e.target.value)})}
                                    className="w-full p-2 bg-white border border-gray-200 rounded-lg text-center font-bold appearance-none"
                                >
                                    <option value="4">4</option>
                                    <option value="6">6</option>
                                    <option value="8">8</option>
                                    <option value="10">10</option>
                                    <option value="12">12</option>
                                    <option value="20">20</option>
                                </select>
                             </div>
                        </div>
                        <div className="mt-2">
                             <label className="text-[10px] uppercase font-bold text-gray-400">Duration (Rounds)</label>
                             <input 
                                type="number" value={form.durationRounds} 
                                onChange={e => setForm({...form, durationRounds: parseInt(e.target.value)||0})}
                                className="w-full p-2 bg-white border border-gray-200 rounded-lg font-bold"
                            />
                        </div>
                    </>
                )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
