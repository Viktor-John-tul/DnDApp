import type { CharacterType } from "../types";
import { Calculator } from "./rules";
import { getSlayerBaseSpeed, getSlayerMaxBreaths } from "./slayerProgression";

export interface LevelProgressionEntry {
  level: number;
  title: string;
  details: string[];
}

export const BASE_ATTRIBUTE_VALUES = {
  strength: 14,
  dexterity: 14,
  constitution: 13,
  wisdom: 12,
  intelligence: 10,
  charisma: 10,
} as const;

function isSlayerLike(characterType?: CharacterType) {
  return characterType !== "demon";
}

export function getAttributePointGainAtLevel(level: number, characterType?: CharacterType) {
  const slayerLike = isSlayerLike(characterType);

  if (!slayerLike && level === 1) {
    return 8;
  }

  if (level >= 4 && level % 2 === 0) {
    return 2;
  }

  return 0;
}

export function getTotalAttributePointsAtLevel(level: number, characterType?: CharacterType) {
  const startingPool = 8;
  let total = startingPool;

  for (let currentLevel = 2; currentLevel <= level; currentLevel += 1) {
    total += getAttributePointGainAtLevel(currentLevel, characterType);
  }

  return total;
}

export function getCreationPointBudget(level: number, characterType?: CharacterType) {
  return getTotalAttributePointsAtLevel(level, characterType);
}

export function getHealingSurgesAtLevel(level: number) {
  const safeLevel = Math.max(1, level);
  if (safeLevel <= 3) return 3;
  return 3 + (safeLevel - 3);
}

function getLevelTitle(level: number) {
  if (level === 1) return "Starting Journey";
  if (level === 20) return "Peak Power";
  if (level % 4 === 0) return "Milestone Level";
  return "Growth";
}

function getProficiencyNote(level: number) {
  const proficiency = Calculator.getProficiencyBonus(level);
  const previous = Calculator.getProficiencyBonus(Math.max(1, level - 1));
  if (proficiency !== previous) {
    return `Proficiency bonus is now +${proficiency}.`;
  }
  return `Proficiency bonus remains +${proficiency}.`;
}

function getSlayerNotes(level: number) {
  const details: string[] = [];
  const currentBreaths = getSlayerMaxBreaths(level);
  const previousBreaths = getSlayerMaxBreaths(Math.max(1, level - 1));
  if (currentBreaths !== previousBreaths) {
    const diff = currentBreaths - previousBreaths;
    details.push(`Breath capacity ${diff > 0 ? `+${diff}` : diff}.`);
  }

  const currentSpeed = getSlayerBaseSpeed(level);
  const previousSpeed = getSlayerBaseSpeed(Math.max(1, level - 1));
  if (currentSpeed !== previousSpeed) {
    const diff = currentSpeed - previousSpeed;
    details.push(`Base speed ${diff > 0 ? `+${diff}` : diff} ft.`);
  }

  if (level >= 10) {
    details.push("Advanced breathing mastery unlocks at this tier.");
  }

  return details;
}

export function getLevelProgressionEntries(characterType?: CharacterType): LevelProgressionEntry[] {
  return Array.from({ length: 20 }, (_, index) => {
    const level = index + 1;
    const details: string[] = [];
    const gain = getAttributePointGainAtLevel(level, characterType);

    if (level === 1) {
      details.push("Base attributes: STR 14, DEX 14, CON 13, WIS 12, INT 10, CHA 10.");
      details.push("+8 free points at creation.");
    } else if (gain === 2) {
      details.push("+2 attribute points (or split +1/+1).");
    } else {
      details.push("—");
    }

    if (isSlayerLike(characterType)) {
      details.push(getProficiencyNote(level));
      details.push(`Proficiency bonus: +${Calculator.getProficiencyBonus(level)}.`);
      details.push(`Max HP scales with level and Constitution.`);
      details.push(...getSlayerNotes(level));
    } else {
      details.push(getProficiencyNote(level));
      details.push(`Max HP scales with level and Constitution.`);
    }

    return {
      level,
      title: getLevelTitle(level),
      details
    };
  });
}

export function getLevelProgressionSummary(level: number, characterType?: CharacterType) {
  const matched = getLevelProgressionEntries(characterType).find((entry) => entry.level === level);
  return matched ?? null;
}
