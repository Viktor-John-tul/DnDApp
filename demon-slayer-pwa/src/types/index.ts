export type FormEffectType = 'damage' | 'attackBuff' | 'advantageBuff' | 'defenseBuff' | 'utility';

export type ActionType = 'main' | 'bonus' | 'reaction' | 'free';

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
}

export interface RPGCharacter {
  id?: string; // Firestore ID
  userId: string; // Owner
  name: string;
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

  // Demon Slayer
  breathingStyleName: string;
  breathingForms: BreathingForm[];

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

  // Buffs
  activeBuff: BuffState;

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
  
  // Timestamps
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}
