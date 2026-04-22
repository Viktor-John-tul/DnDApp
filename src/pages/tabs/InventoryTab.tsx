import { useState } from "react";
import { Coins, Trash2, Plus, Minus, Weight, Backpack, Skull, Sparkles, Check, Shield } from "lucide-react";
import type { RPGCharacter, InventoryItem } from "../../types";
import { useToast } from "../../context/ToastContext";
import { Calculator, getEquippedSpecialItemCount, getSpecialItemSlotCap, resolveEquippedSpecialItemBonuses } from "../../services/rules";

interface Props {
  character: RPGCharacter;
  onUpdate: (updates: Partial<RPGCharacter>) => void;
  readOnly?: boolean;
}

export function InventoryTab({ character, onUpdate, readOnly }: Props) {
  const { showToast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({ name: "", quantity: 1, weight: 0 });

    const itemBonuses = resolveEquippedSpecialItemBonuses(character.inventory || []);
    const effectiveStrength = character.strength + itemBonuses.attributeBonuses.strength;
    const currentLoad = Calculator.getCurrentLoad(character.inventory || []);
    const maxLoad = character.type === 'demon' ? Number.POSITIVE_INFINITY : Calculator.getMaxLoad(effectiveStrength) + itemBonuses.carryCapacityBonus;
    const specialItemLimit = getSpecialItemSlotCap(character.level);
    const equippedSpecialCount = getEquippedSpecialItemCount(character.inventory);

  const handleAddItem = () => {
    if (!newItem.name) return;
    const item: InventoryItem = {
        id: crypto.randomUUID(),
        name: newItem.name,
        description: "",
        quantity: newItem.quantity || 1,
        weight: newItem.weight || 0,
        rarity: 'common'
    };
    onUpdate({ inventory: [...character.inventory, item] });
    setIsAdding(false);
    setNewItem({ name: "", quantity: 1, weight: 0 });
  };

  const updateKills = (change: number) => {
    if (readOnly) return;
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
        showToast("Demon Blood Power Up! All attributes increased by +1", "success");
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
    if (readOnly) return;
    onUpdate({ inventory: character.inventory.filter(i => i.id !== id) });
  };

    const handleToggleEquip = (id: string) => {
        if (readOnly) return;

        const item = character.inventory.find(entry => entry.id === id);
        if (!item || item.rarity !== 'special') return;

        const currentlyEquipped = Boolean(item.equipped);
        if (!currentlyEquipped && equippedSpecialCount >= specialItemLimit) {
            showToast(`You can only equip ${specialItemLimit} special items at your current level.`, 'error');
            return;
        }

        const inventory = character.inventory.map(entry =>
            entry.id === id ? { ...entry, equipped: !currentlyEquipped } : entry
        );

        onUpdate({ inventory });

        showToast(
            `${item.name} ${currentlyEquipped ? 'unequipped' : 'equipped'}.`,
            'success'
        );
    };

    const describeEffect = (item: InventoryItem) => {
        if (!item.effects || item.effects.length === 0) return null;

        return item.effects.map(effect => {
            const amount = effect.amount ?? 0;

            if (effect.kind === 'attributeBonus' && effect.attribute) {
                return `${amount >= 0 ? '+' : ''}${amount} ${effect.attribute.slice(0, 3).toUpperCase()}`;
            }

            if (effect.kind === 'rollBonus' && effect.target) {
                if (effect.target === 'attack') return `${amount >= 0 ? '+' : ''}${amount} to attack`;
                if (effect.target === 'damage') return `${amount >= 0 ? '+' : ''}${amount} to damage`;
                if (effect.target === 'initiative') return `${amount >= 0 ? '+' : ''}${amount} initiative`;
                if (effect.target === 'ac') return `${amount >= 0 ? '+' : ''}${amount} AC`;
                if (effect.target === 'speed') return `${amount >= 0 ? '+' : ''}${amount} speed`;
                if (effect.target === 'maxHP') return `${amount >= 0 ? '+' : ''}${amount} max HP`;
                if (effect.target === 'carryCapacity') return `${amount >= 0 ? '+' : ''}${amount} carry capacity`;
                if (effect.target === 'check' && effect.ability) return `${amount >= 0 ? '+' : ''}${amount} ${effect.ability} checks`;
                if (effect.target === 'save' && effect.ability) return `${amount >= 0 ? '+' : ''}${amount} ${effect.ability} saves`;
                if (effect.target === 'skill' && effect.skillName) return `${amount >= 0 ? '+' : ''}${amount} ${effect.skillName}`;
            }

            if (effect.kind === 'advantage' && effect.target) {
                if (effect.target === 'skill' && effect.skillName) return `Advantage on ${effect.skillName}`;
                if (effect.target === 'check' && effect.ability) return `Advantage on ${effect.ability} checks`;
                if (effect.target === 'save' && effect.ability) return `Advantage on ${effect.ability} saves`;
                return `Advantage on ${effect.target}`;
            }

            if (effect.kind === 'resistance' && effect.damageType) {
                return `${effect.damageType} resistance`;
            }

            return effect.name;
        });
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
                    <button onClick={() => !readOnly && updateKills(-1)} className={`w-8 h-8 flex items-center justify-center bg-red-800 text-red-200 rounded font-bold ${readOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-700'}`}><Minus size={14}/></button>
                    <div className="flex flex-col items-center">
                         <span className="text-3xl font-black text-red-500">{character.kills || 0}</span>
                         <span className="text-[10px] font-bold text-red-700 uppercase">Humans Devoured</span>
                    </div>
                    <button onClick={() => !readOnly && updateKills(1)} className={`w-8 h-8 flex items-center justify-center bg-red-600 text-white rounded font-bold ${readOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-500'}`}><Plus size={14}/></button>
                </div>
            </div>
        ) : (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-100 dark:border-amber-900/40 flex flex-col items-center justify-center">
                <Coins className="text-amber-500 dark:text-amber-300 mb-1" size={20} />
                <span className="text-2xl font-black text-amber-900 dark:text-amber-100">{character.gold}</span>
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-300 uppercase">Gold Pieces</span>
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
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-gray-400 bg-white border border-gray-200 px-2 py-1 rounded-full">
                    Special {equippedSpecialCount}/{specialItemLimit}
                </span>
                {!readOnly && (
                <button 
                    onClick={() => setIsAdding(!isAdding)}
                    className="text-xs bg-gray-900 text-white px-2 py-1 rounded-md font-bold"
                >
                    {isAdding ? "Cancel" : "Add Item"}
                </button>
                )}
            </div>
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
                    <div className="min-w-0">
                        <div className="font-bold text-gray-800 text-sm flex items-center gap-2 flex-wrap">
                            <span className="truncate">{item.name}</span>
                            {item.rarity === 'special' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                    <Sparkles size={10} /> Special
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                                    Common
                                </span>
                            )}
                            {item.rarity === 'special' && item.equipped && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                    <Check size={10} /> Equipped
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 space-y-1">
                            <div>
                                {item.weight > 0 && `${item.weight} lbs`}
                                {item.quantity > 1 && ` • x${item.quantity}`}
                            </div>
                            {item.rarity === 'special' && item.effects && item.effects.length > 0 && (
                                (() => {
                                    const effectDescriptions = describeEffect(item);
                                    if (!effectDescriptions) return null;
                                    return (
                                <div className="flex flex-wrap gap-1.5">
                                    {effectDescriptions.map((effectText, index) => (
                                        <span key={`${item.id}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-semibold">
                                            <Shield size={10} /> {effectText}
                                        </span>
                                    ))}
                                </div>
                                    );
                                })()
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!readOnly && item.rarity === 'special' && (
                            <button
                                onClick={() => handleToggleEquip(item.id)}
                                className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${item.equipped ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}
                            >
                                {item.equipped ? 'Unequip' : 'Equip'}
                            </button>
                        )}
                        {!readOnly && (
                        <button 
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <Trash2 size={16} />
                        </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}
