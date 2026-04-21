import React from 'react';
import type { CombatAction, ActionType } from "../types";
import { X, Sword, Zap, Clock, ZapOff } from 'lucide-react';

interface Props {
  action?: CombatAction;
  initialType?: ActionType;
  onSave: (action: CombatAction) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

const ACTION_TYPES: { value: ActionType; label: string; icon: any; color: string }[] = [
    { value: 'main', label: 'Main Action', icon: Sword, color: 'text-red-500' },
    { value: 'bonus', label: 'Bonus Action', icon: Zap, color: 'text-amber-500' },
    { value: 'reaction', label: 'Reaction', icon: Clock, color: 'text-blue-500' },
    { value: 'free', label: 'Free Action', icon: ZapOff, color: 'text-green-500' },
];

export function CombatActionEditorModal({ action, initialType = 'main', onSave, onClose, onDelete }: Props) {
    const [name, setName] = React.useState(action?.name || "");
    const [description, setDescription] = React.useState(action?.description || "");
    const [type, setType] = React.useState<ActionType>(action?.type || initialType);

    const handleSave = () => {
        if (!name.trim()) return;
        
        onSave({
            id: action?.id || crypto.randomUUID(),
            name,
            description,
            type
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="font-bold text-lg">{action ? 'Edit Action' : 'New Action'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Action Name</label>
                        <input 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Second Wind, Dash"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-slayer-orange focus:bg-white outline-none transition-all"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                        <div className="grid grid-cols-2 gap-2">
                            {ACTION_TYPES.map(t => (
                                <button
                                    key={t.value}
                                    onClick={() => setType(t.value)}
                                    className={`p-3 rounded-xl border flex items-center gap-2 transition-all text-left ${
                                        type === t.value 
                                        ? 'bg-slayer-orange/5 border-slayer-orange ring-1 ring-orange-200' 
                                        : 'bg-white border-gray-100 hover:bg-gray-50'
                                    }`}
                                >
                                    <t.icon size={18} className={type === t.value ? 'text-slayer-orange' : 'text-gray-400'} />
                                    <span className={`text-sm font-bold ${type === t.value ? 'text-slayer-orange' : 'text-gray-500'}`}>
                                        {t.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                        <textarea 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe what this action does..."
                            rows={3}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slayer-orange focus:bg-white outline-none transition-all resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        {action && onDelete && (
                            <button 
                                onClick={() => {
                                    if(confirm("Delete this action?")) {
                                        onDelete(action.id);
                                        onClose();
                                    }
                                }}
                                className="px-4 py-3 bg-red-50 text-red-500 font-bold rounded-xl hover:bg-red-100 transition-colors"
                            >
                                Delete
                            </button>
                        )}
                        <button 
                            onClick={handleSave}
                            disabled={!name.trim()}
                            className="flex-1 py-3 bg-slayer-orange text-white font-bold rounded-xl shadow-lg shadow-orange-200 disabled:opacity-50 active:scale-95 transition-all"
                        >
                            Save Action
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
