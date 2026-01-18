import { useState } from "react";
import { Coins, Trash2, Plus, Weight, Backpack } from "lucide-react";
import type { RPGCharacter, InventoryItem } from "../../types";

interface Props {
  character: RPGCharacter;
  onUpdate: (updates: Partial<RPGCharacter>) => void;
}

export function InventoryTab({ character, onUpdate }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({ name: "", quantity: 1, weight: 0 });

  const currentLoad = character.inventory.reduce((acc, item) => acc + (item.weight * item.quantity), 0);
  const maxLoad = character.strength * 15; // Standard 5e carry capacity

  const handleAddItem = () => {
    if (!newItem.name) return;
    const item: InventoryItem = {
        id: crypto.randomUUID(),
        name: newItem.name,
        description: "",
        quantity: newItem.quantity || 1,
        weight: newItem.weight || 0
    };
    onUpdate({ inventory: [...character.inventory, item] });
    setIsAdding(false);
    setNewItem({ name: "", quantity: 1, weight: 0 });
  };

  const handleRemoveItem = (id: string) => {
    onUpdate({ inventory: character.inventory.filter(i => i.id !== id) });
  };

  return (
    <div className="space-y-6 pb-24">
      
      {/* Money & Load Header */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex flex-col items-center justify-center">
            <Coins className="text-amber-500 mb-1" size={20} />
            <span className="text-2xl font-black text-amber-900">{character.gold}</span>
            <span className="text-[10px] font-bold text-amber-600 uppercase">Gold Pieces</span>
        </div>
        <div className={`rounded-xl p-4 border flex flex-col items-center justify-center ${currentLoad > maxLoad ? 'bg-red-50 border-red-100 text-red-900' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
            <Weight className={currentLoad > maxLoad ? "text-red-500 mb-1" : "text-gray-400 mb-1"} size={20} />
            <span className="text-2xl font-black">{currentLoad} <span className="text-sm font-normal text-gray-400">/ {maxLoad}</span></span>
            <span className="text-[10px] font-bold uppercase opacity-60">Lbs Carried</span>
        </div>
      </div>

      {/* Item List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <Backpack size={16} /> Inventory
            </h3>
            <button 
                onClick={() => setIsAdding(!isAdding)}
                className="text-xs bg-gray-900 text-white px-2 py-1 rounded-md font-bold"
            >
                {isAdding ? "Cancel" : "Add Item"}
            </button>
        </div>

        {isAdding && (
            <div className="p-3 bg-gray-50 border-b border-gray-100 flex gap-2 items-center">
                <input 
                    placeholder="Item Name" 
                    className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-sm"
                    value={newItem.name}
                    onChange={e => setNewItem({...newItem, name: e.target.value})}
                />
                <input 
                    type="number" placeholder="Qty" className="w-12 bg-white border border-gray-200 rounded px-1 py-1 text-sm text-center"
                    value={newItem.quantity}
                    onChange={e => setNewItem({...newItem, quantity: parseInt(e.target.value)})}
                />
                 <input 
                    type="number" placeholder="Lbs" className="w-12 bg-white border border-gray-200 rounded px-1 py-1 text-sm text-center"
                    value={newItem.weight}
                    onChange={e => setNewItem({...newItem, weight: parseFloat(e.target.value)})}
                />
                <button 
                    onClick={handleAddItem}
                    className="bg-green-500 text-white p-1 rounded hover:bg-green-600"
                >
                    <Plus size={16} />
                </button>
            </div>
        )}

        <div className="divide-y divide-gray-100">
            {character.inventory.length === 0 && !isAdding && (
                <div className="p-8 text-center text-gray-400 text-sm">Empty Backpack</div>
            )}
            {character.inventory.map(item => (
                <div key={item.id} className="p-4 flex justify-between items-center group">
                    <div>
                        <div className="font-bold text-gray-800 text-sm">{item.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                            {item.weight > 0 && `${item.weight} lbs`}
                            {item.quantity > 1 && ` • x${item.quantity}`}
                        </div>
                    </div>
                    <button 
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}
