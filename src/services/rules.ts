import type { InventoryItem, ItemAbilityShort, ItemAttributeKey, ItemEffect, ItemEffectStacking } from "../types";

export interface ResolvedSpecialItemBonuses {
    attributeBonuses: Record<ItemAttributeKey, number>;
    attackBonus: number;
    damageBonus: number;
    initiativeBonus: number;
    acBonus: number;
    speedBonus: number;
    maxHPBonus: number;
    carryCapacityBonus: number;
    checkBonuses: Partial<Record<ItemAbilityShort | 'all', number>>;
    saveBonuses: Partial<Record<ItemAbilityShort | 'all', number>>;
    skillBonuses: Record<string, number>;
    attackAdvantage: boolean;
    damageAdvantage: boolean;
    initiativeAdvantage: boolean;
    checkAdvantage: Partial<Record<ItemAbilityShort | 'all', boolean>>;
    saveAdvantage: Partial<Record<ItemAbilityShort | 'all', boolean>>;
    skillAdvantage: Record<string, boolean>;
    resistances: string[];
    activeEffects: ItemEffect[];
}

const ATTRIBUTE_KEYS: ItemAttributeKey[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

const createAttributeRecord = (value = 0): Record<ItemAttributeKey, number> =>
    ATTRIBUTE_KEYS.reduce((record, key) => {
        record[key] = value;
        return record;
    }, {} as Record<ItemAttributeKey, number>);

const createBlankBonuses = (): ResolvedSpecialItemBonuses => ({
    attributeBonuses: createAttributeRecord(),
    attackBonus: 0,
    damageBonus: 0,
    initiativeBonus: 0,
    acBonus: 0,
    speedBonus: 0,
    maxHPBonus: 0,
    carryCapacityBonus: 0,
    checkBonuses: {},
    saveBonuses: {},
    skillBonuses: {},
    attackAdvantage: false,
    damageAdvantage: false,
    initiativeAdvantage: false,
    checkAdvantage: {},
    saveAdvantage: {},
    skillAdvantage: {},
    resistances: [],
    activeEffects: [],
});

const normalizeKey = (value: string) => value.trim().toLowerCase();

const normalizeStacking = (kind: ItemEffect['kind'], stacking?: ItemEffectStacking): ItemEffectStacking => {
    if (stacking) return stacking;

    switch (kind) {
        case 'advantage':
        case 'resistance':
            return 'highest';
        case 'triggered':
        case 'utility':
            return 'override';
        default:
            return 'stack';
    }
};

const applyNumericStacking = (current: number | undefined, amount: number, stacking: ItemEffectStacking) => {
    if (current === undefined) return amount;

    switch (stacking) {
        case 'highest':
            return Math.max(current, amount);
        case 'override':
            return amount;
        case 'stack':
        default:
            return current + amount;
    }
};

const getAbilityKey = (ability?: ItemAbilityShort) => ability ?? 'all';

const isSpecialItem = (item: InventoryItem) => item.rarity === 'special';

export const getSpecialItemSlotCap = (level: number) => {
    if (level <= 5) return 3;
    if (level <= 11) return 4;
    return 5;
};

export const getEquippedSpecialItemCount = (inventory: InventoryItem[]) =>
    inventory.filter((item) => isSpecialItem(item) && item.equipped).length;

export const getEquippedSpecialItems = (inventory: InventoryItem[]) =>
    inventory.filter((item) => isSpecialItem(item) && item.equipped && Array.isArray(item.effects) && item.effects.length > 0);

export const resolveEquippedSpecialItemBonuses = (inventory: InventoryItem[]): ResolvedSpecialItemBonuses => {
    const bonuses = createBlankBonuses();
    const numericBuckets = new Map<string, number>();

    const addNumeric = (key: string, amount: number, stacking?: ItemEffectStacking) => {
        const nextStacking = stacking ?? 'stack';
        const current = numericBuckets.get(key);
        const nextValue = applyNumericStacking(current, amount, nextStacking);
        numericBuckets.set(key, nextValue);
    };

    const equippedItems = getEquippedSpecialItems(inventory);
    bonuses.activeEffects = equippedItems.flatMap((item) => item.effects || []);

    equippedItems.forEach((item) => {
        (item.effects || []).forEach((effect) => {
            const amount = effect.amount ?? 0;
            const stacking = normalizeStacking(effect.kind, effect.stacking);

            if (effect.kind === 'attributeBonus' && effect.attribute) {
                addNumeric(`attribute:${effect.attribute}`, amount, stacking);
                return;
            }

            if (effect.kind === 'rollBonus' && effect.target) {
                if (effect.target === 'attack' || effect.target === 'damage' || effect.target === 'initiative') {
                    addNumeric(`roll:${effect.target}`, amount, stacking);
                    return;
                }

                if (effect.target === 'check') {
                    addNumeric(`check:${getAbilityKey(effect.ability)}`, amount, stacking);
                    return;
                }

                if (effect.target === 'save') {
                    addNumeric(`save:${getAbilityKey(effect.ability)}`, amount, stacking);
                    return;
                }

                if (effect.target === 'skill') {
                    addNumeric(`skill:${normalizeKey(effect.skillName || 'all')}`, amount, stacking);
                    return;
                }

                if (effect.target === 'ac' || effect.target === 'speed' || effect.target === 'maxHP' || effect.target === 'carryCapacity') {
                    addNumeric(`defense:${effect.target}`, amount, stacking);
                    return;
                }
            }

            if (effect.kind === 'defenseBonus' && effect.target) {
                addNumeric(`defense:${effect.target}`, amount, stacking);
                return;
            }

            if (effect.kind === 'advantage' && effect.target) {
                const key = effect.target === 'skill'
                    ? `advantage:skill:${normalizeKey(effect.skillName || 'all')}`
                    : effect.target === 'check'
                        ? `advantage:check:${getAbilityKey(effect.ability)}`
                        : effect.target === 'save'
                            ? `advantage:save:${getAbilityKey(effect.ability)}`
                            : `advantage:${effect.target}`;

                numericBuckets.set(key, 1);
                return;
            }

            if (effect.kind === 'resistance' && effect.damageType) {
                const key = `resistance:${normalizeKey(effect.damageType)}`;
                numericBuckets.set(key, 1);
            }
        });
    });

    numericBuckets.forEach((value, key) => {
        if (key.startsWith('attribute:')) {
            const attribute = key.split(':')[1] as ItemAttributeKey;
            bonuses.attributeBonuses[attribute] = value;
            return;
        }

        if (key.startsWith('roll:')) {
            const rollTarget = key.split(':')[1];
            if (rollTarget === 'attack') bonuses.attackBonus = value;
            if (rollTarget === 'damage') bonuses.damageBonus = value;
            if (rollTarget === 'initiative') bonuses.initiativeBonus = value;
            return;
        }

        if (key.startsWith('defense:')) {
            const defenseTarget = key.split(':')[1];
            if (defenseTarget === 'ac') bonuses.acBonus = value;
            if (defenseTarget === 'speed') bonuses.speedBonus = value;
            if (defenseTarget === 'maxHP') bonuses.maxHPBonus = value;
            if (defenseTarget === 'carryCapacity') bonuses.carryCapacityBonus = value;
            return;
        }

        if (key.startsWith('check:')) {
            const ability = key.split(':')[1] as ItemAbilityShort | 'all';
            bonuses.checkBonuses[ability] = value;
            return;
        }

        if (key.startsWith('save:')) {
            const ability = key.split(':')[1] as ItemAbilityShort | 'all';
            bonuses.saveBonuses[ability] = value;
            return;
        }

        if (key.startsWith('skill:')) {
            const skill = key.slice('skill:'.length);
            bonuses.skillBonuses[skill] = value;
            return;
        }

        if (key === 'advantage:attack') bonuses.attackAdvantage = true;
        if (key === 'advantage:damage') bonuses.damageAdvantage = true;
        if (key === 'advantage:initiative') bonuses.initiativeAdvantage = true;

        if (key.startsWith('advantage:check:')) {
            const ability = key.split(':')[2] as ItemAbilityShort | 'all';
            bonuses.checkAdvantage[ability] = true;
            return;
        }

        if (key.startsWith('advantage:save:')) {
            const ability = key.split(':')[2] as ItemAbilityShort | 'all';
            bonuses.saveAdvantage[ability] = true;
            return;
        }

        if (key.startsWith('advantage:skill:')) {
            const skill = key.slice('advantage:skill:'.length);
            bonuses.skillAdvantage[skill] = true;
            return;
        }

        if (key.startsWith('resistance:')) {
            const damageType = key.slice('resistance:'.length);
            if (!bonuses.resistances.includes(damageType)) {
                bonuses.resistances.push(damageType);
            }
        }
    });

    return bonuses;
};

export interface RollResult {
    total: number;
    die: number;
    modifier: number;
    isCrit: boolean;
    isFail: boolean;
    rolls?: number[]; // For advantage/disadvantage, stores both
}

export type RollMode = 'normal' | 'advantage' | 'disadvantage';

export const Calculator = {
    getModifier: (score: number) => Math.floor((score - 10) / 2),
    
    getProficiencyBonus: (level: number) => Math.floor((level - 1) / 4) + 2,
    
    getAC: (dex: number) => 10 + Calculator.getModifier(dex),
    
    getMaxHP: (con: number, level: number) => {
        const conMod = Calculator.getModifier(con);
        return (8 + conMod) * level; // Fixed HP rule from Swift
    },

    getMaxLoad: (str: number) => 80.0 + (str * 2),

    getCurrentLoad: (inventory: {weight: number, quantity: number}[]) => {
        return inventory.reduce((total, item) => total + (item.weight * item.quantity), 0);
    },

    isEncumbered: (str: number, inventory: {weight: number, quantity: number}[]) => {
        return Calculator.getCurrentLoad(inventory) > Calculator.getMaxLoad(str);
    },

    getSpeed: (isEncumbered: boolean, baseSpeed: number = 30) => isEncumbered ? 15 : baseSpeed,

    getSkillBonus: (
        skill: string, 
        stats: {str: number, dex: number, con: number, int: number, wis: number, cha: number},
        proficiencyBonus: number,
        isProficient: boolean
    ) => {
        let score = 0;
        if (skill.includes("(Str)")) score = stats.str;
        else if (skill.includes("(Dex)")) score = stats.dex;
        else if (skill.includes("(Con)")) score = stats.con;
        else if (skill.includes("(Int)")) score = stats.int;
        else if (skill.includes("(Wis)")) score = stats.wis;
        else if (skill.includes("(Cha)")) score = stats.cha;
        
        return Calculator.getModifier(score) + (isProficient ? proficiencyBonus : 0);
    },

    // Returns true if the skill should have disadvantage due to encumbrance
    hasEncumbranceDisadvantage: (skill: string, isEncumbered: boolean) => {
        if (!isEncumbered) return false;
        const physicalSkills = ["Acrobatics (Dex)", "Athletics (Str)", "Stealth (Dex)", "Performance (Cha)"]; 
        // Note: Performance is Cha but Swift code flagged it too, mirroring that.
        // Actually, let's double check the swift summary: "Encumbered... disadvantage on physical skills".
        // The subagent research mentioned "Acrobatics, Athletics, Performance, Stealth".
        return physicalSkills.some(s => skill.includes(s.split(" ")[0]));
    }
};

export const DiceRoller = {
    rollD20: (mode: RollMode = 'normal'): RollResult => {
        const roll1 = Math.floor(Math.random() * 20) + 1;
        const roll2 = Math.floor(Math.random() * 20) + 1;
        
        let die = roll1;
        let rolls = [roll1];

        if (mode === 'advantage') {
            die = Math.max(roll1, roll2);
            rolls = [roll1, roll2];
        } else if (mode === 'disadvantage') {
            die = Math.min(roll1, roll2);
            rolls = [roll1, roll2];
        }

        return {
            total: die, // Just the die for now, modifier added later usually
            die,
            modifier: 0,
            isCrit: die === 20,
            isFail: die === 1,
            rolls
        };
    },

    rollDamage: (count: number, face: number, modifier: number = 0) => {
        let total = 0; 
        const individual = [];
        for (let i = 0; i < count; i++) {
            const r = Math.floor(Math.random() * face) + 1;
            total += r;
            individual.push(r);
        }
        return { total: total + modifier, individual, modifier };
    }
};
