// import type { RPGCharacter } from "../types";

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

    getSpeed: (isEncumbered: boolean) => isEncumbered ? 15 : 30,

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
