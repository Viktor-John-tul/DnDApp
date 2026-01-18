import { useState } from "react";
import { Coins, Trash2, Plus, Minus, Weight, Backpack, Skull } from "lucide-react";
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

  const updateKills = (change: number) => {
    const currentKills = character.kills || 0;
    const newKills = Math.max(0, currentKills + change);
    
    // Check for power up milestone (Every 10 kills)
    // Only apply if INCREASING and hitting a multiple of 10
    let updates: Partial<RPGCharacter> = { kills: newKills };
    
    if (change > 0 && newKills % 10 === 0 && newKills > 0) {
        // Power-up!
        updates = {
            ...updates,
            strength: character.strength + 1,
            dexterity: character.dexterity + 1,
            constitution: character.constitution + 1,
            intelligence: character.intelligence + 1,
            wisdom: character.wisdom + 1,
            charisma: character.charisma + 1,
            // Also update HP? Assuming customHP manual update is preferred for demons, 
            // but Constitution affects HP. We should probably leave HP alone if it's manual.
        };
        alert("Demon Blood Power Up! All attributes increased by +1");
    } else if (change < 0 && (newKills + 1) % 10 === 0) {
         // Reverting power up? User didn't specify. I will perform it to keep it consistent.
         updates = {
            ...updates,
            strength: Math.max(1, character.strength - 1),
            dexterity: Math.max(1, character.dexterity - 1),
            constitution: Math.max(1, character.constitution - 1),
            intelligence: Math.max(1, character.intelligence - 1),
            wisdom: Math.max(1, character.wisdom - 1),
            charisma: Math.max(1, character.charisma - 1),
        };
    }

    onUpdate(updates);
  };

  const handleRemoveItem = (id: string) => {
    onUpdate({ inventory: character.inventory.filter(i => i.id !== id) });
  };

  const isDemon = character.type === 'demon';

  return (
    <div className="space-y-6 pb-24">
      
      {/* Money & Load Header */}
      <div className="grid grid-cols-2 gap-3">
        {isDemon ? (
             <div className="bg-red-950 rounded-xl p-4 border border-red-900 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1 opacity-20"><Skull size={40} /></div>
                <div className="flex items-center gap-3 z-10">
                    <button onClick={() => updateKills(-1)} className="w-8 h-8 flex items-center justify-center bg-red-800 text-red-200 rounded hover:bg-red-700 font-bold"><Minus size={14}/></button>
                    <div className="flex flex-col items-center">
                         <span className="text-3xl font-black text-red-500">{character.kills || 0}</span>
                         <span className="text-[10px] font-bold text-red-700 uppercase">Humans Devoured</span>
                    </div>
                    <button onClick={() => updateKills(1)} className="w-8 h-8 flex items-center justify-center bg-red-600 text-white rounded hover:bg-red-500 font-bold"><Plus size={14}/></button>
                </div>
            </div>
        ) : (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex flex-col items-center justify-center">
                <Coins className="text-amber-500 mb-1" size={20} />
                <span className="text-2xl font-black text-amber-900">{character.gold}</span>
                <span className="text-[10px] font-bold text-amber-600 uppercase">Gold Pieces</span>
            </div>
        )}

        {!isDemon && (
            <div className={`rounded-xl p-4 border flex flex-col items-center justify-center ${currentLoad > maxLoad ? 'bg-red-50 border-red-100 text-red-900' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
                <Weight className={currentLoad > maxLoad ? "text-red-500 mb-1" : "text-gray-400 mb-1"} size={20} />
                <span className="text-2xl font-black">{currentLoad} <span className="text-sm font-normal text-gray-400">/ {maxLoad}</span></span>
                <span className="text-[10px] font-bold uppercase opacity-60">Lbs Carried</span>
            </div>
        )}
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
