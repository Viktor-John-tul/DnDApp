import type { CharacterType, RPGCharacter } from "../types";

const SLAYER_BASE_BREATH = 100;
const SLAYER_BASE_SPEED = 40;

const SLAYER_BREATH_BONUS_LEVELS = [4, 6, 8, 10, 12, 14, 16, 18, 20];

export function isSlayerType(type?: CharacterType) {
  return type === "slayer" || type === undefined;
}

export function isSlayerCharacter(character: RPGCharacter) {
  return isSlayerType(character.type);
}

export function getSlayerBreathBonus(level: number) {
  const bonusTicks = SLAYER_BREATH_BONUS_LEVELS.filter((lvl) => level >= lvl).length;
  return bonusTicks * 10;
}

export function getSlayerMaxBreaths(level: number) {
  let maxBreaths = SLAYER_BASE_BREATH + getSlayerBreathBonus(level);
  if (level >= 10) {
    maxBreaths += 50;
  }
  return maxBreaths;
}

export function getSlayerSpeedBonus(level: number) {
  let bonus = 0;
  if (level >= 2) bonus += 5;
  if (level >= 5) bonus += 5;
  if (level >= 10) bonus += 10;
  if (level >= 15) bonus += 5;
  if (level >= 20) bonus += 10;
  if (level >= 20) bonus += 20; // Slayer Mark Ascension
  return bonus;
}

export function getSlayerBaseSpeed(level: number) {
  return SLAYER_BASE_SPEED + getSlayerSpeedBonus(level);
}

export function getEffectiveMaxBreaths(character: RPGCharacter) {
  return isSlayerCharacter(character) ? getSlayerMaxBreaths(character.level) : character.maxBreaths;
}

export function getSlayerFormCost(level: number, formNumber: number, applyBladeMemory: boolean) {
  let cost = formNumber * 3;
  if (level >= 10) {
    cost -= 4 * formNumber;
  }
  if (applyBladeMemory) {
    cost = Math.ceil(cost / 2);
  }
  return Math.max(1, cost);
}

// TODO: Hook demon kill tracking to grant +10 current Breath at level 4+.
