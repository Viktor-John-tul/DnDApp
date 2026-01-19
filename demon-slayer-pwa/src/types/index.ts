export type FormEffectType = 'damage' | 'attackBuff' | 'advantageBuff' | 'defenseBuff' | 'utility' | 'heal';

export type ActionType = 'main' | 'bonus' | 'reaction' | 'free';

export type StatusEffectType = 'advantage' | 'disadvantage' | 'condition';

export interface StatusEffect {
  id: string;
  name: string; // "Advantage", "Poisoned", "Stunned"
  type: StatusEffectType;
  description?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  weight: number;
}

export interface BreathingForm {
  id: string;
  name: string;
  description: string;
  requiresAttackRoll: boolean;
  durationRounds: number;
  diceCount: number;
  diceFace: number;
  spCost: number;
  effectType: FormEffectType;
}

export type CharacterType = 'slayer' | 'demon';

export interface BloodDemonArt extends BreathingForm {
    // Extends BreathingForm structure for compatibility
    // Uses 'heal' effect type for healing arts
}

export interface CombatAction {
  id: string;
  name: string;
  description: string;
  type: ActionType;
}

export interface BuffState {
  activeBuffFormID: string | null;
  activeBuffName: string | null;
  activeBuffDiceCount: number | null;
  activeBuffDiceFace: number | null;
  activeBuffRoundsRemaining: number | null;
  isAdvantageBuff?: boolean;
  isRegenBuff?: boolean;
}

export interface RPGCharacter {
  id?: string; // Firestore ID
  userId: string; // Owner
  name: string;
  type?: CharacterType; // 'slayer' | 'demon'

  characterClass: string;
  level: number;

  // Stats
  strength: number;
  dexterity: number;

  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;

  // Mechanics
  proficientSkills: string[];
  proficientSavingThrows: string[];
  photoUrl: string | null;

  // Manual Stats (For Demons/Custom)
  customAC?: number;
  customInitiative?: number;
  customSpeed?: number;
  customProficiency?: number;
  customMaxHP?: number;

  // Demon Slayer
  breathingStyleName: string;
  breathingForms: BreathingForm[];

  // Demon
  bloodDemonArtName?: string;
  bloodDemonArts?: BloodDemonArt[];
  kills?: number;

  // Breaths
  currentBreaths: number;
  maxBreaths: number;
  currentOverdraftDC: number;

  // Health
  currentHP: number;
  maxHP: number;
  healingSurges: number;

  // Death Saves
  deathSaveSuccesses: number;
  deathSaveFailures: number;

  // Inventory & Money
  gold: number;
  inventory: InventoryItem[];

  // Combat
  customActions: CombatAction[];
  statusEffects?: StatusEffect[];

  // Buffs
  activeBuff?: BuffState | null;

  // Bio
  age: string;
  height: string;
  weight: string;
  eyes: string;
  skin: string;
  hair: string;
  personalityTraits: string;
  ideals: string;
  bonds: string;
  flaws: string;
  backstory: string;
  notes: string;
  dmNotes?: string;
  
  // Timestamps
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}
