export type FormEffectType = 'damage' | 'attackBuff' | 'advantageBuff' | 'defenseBuff' | 'utility' | 'heal';

export type ItemRarity = 'common' | 'special';

export type ItemEffectKind = 'attributeBonus' | 'rollBonus' | 'defenseBonus' | 'advantage' | 'resistance' | 'triggered' | 'utility';

export type ItemEffectTrigger =
  | 'passive'
  | 'onEquip'
  | 'onUnequip'
  | 'onAttack'
  | 'onDamage'
  | 'onCheck'
  | 'onSave'
  | 'onHit'
  | 'onTurnStart'
  | 'onTurnEnd'
  | 'oncePerTurn'
  | 'oncePerRest';

export type ItemEffectStacking = 'stack' | 'highest' | 'override';

export type ItemAttributeKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

export type ItemAbilityShort = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export type ItemEffectTarget = 'attack' | 'damage' | 'initiative' | 'check' | 'save' | 'skill' | 'ac' | 'speed' | 'maxHP' | 'carryCapacity';

export interface ItemEffect {
  id: string;
  name: string;
  kind: ItemEffectKind;
  target?: ItemEffectTarget;
  attribute?: ItemAttributeKey;
  ability?: ItemAbilityShort;
  skillName?: string;
  amount?: number;
  trigger?: ItemEffectTrigger;
  stacking?: ItemEffectStacking;
  durationRounds?: number;
  usesPerRest?: number;
  damageType?: string;
  description?: string;
}

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
  source?: 'dm' | 'player' | 'loot';
  rarity?: ItemRarity;
  equipped?: boolean;
  effects?: ItemEffect[];
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
  isLocked?: boolean;
}

export type CharacterType = 'slayer' | 'demon' | 'human';

export interface BloodDemonArt extends BreathingForm {
    // Extends BreathingForm structure for compatibility
    // Uses 'heal' effect type for healing arts
}

export interface Combatant {
  id: string;
  name: string;
  initiative: number;
  type: 'player' | 'npc';
  isHidden?: boolean;
  maxHP?: number;
  currentHP?: number;
  photoUrl?: string | null;
}

export interface CombatState {
  isActive: boolean;
  phase: 'setup' | 'active';
  round: number;
  currentTurnIndex: number;
  participants: Combatant[];
}

export interface MapPoint {
  x: number;
  y: number;
}

export interface MapCalibration {
  pointA: MapPoint;
  pointB: MapPoint;
  distanceFt: number;
  pixelsPerFoot: number;
}

export type MapMarkerKind = 'character' | 'npc' | 'custom';
export type MapMovementMode = 'inherit' | 'fixed' | 'unlimited';

export interface MapSpeedModifier {
  id: string;
  amountFt: number;
  source?: string;
  expiresAtTurnKey?: string;
}

export interface MapMoveSnapshot {
  position: MapPoint;
  remainingMovementFt?: number;
  at: number;
  byUserId: string;
  turnKey?: string;
}

export interface MapToken {
  id: string;
  label: string;
  kind: MapMarkerKind;
  position: MapPoint;
  color?: string;
  photoUrl?: string | null;
  ownerUserId?: string;
  ownerCharacterId?: string;
  isLocked?: boolean;
  movementMode: MapMovementMode;
  speedFt?: number;
  remainingMovementFt?: number;
  speedModifiers?: MapSpeedModifier[];
  lastMove?: MapMoveSnapshot;
  createdAt: number;
  updatedAt: number;
}

export interface MapFogStroke {
  id: string;
  mode: 'draw' | 'erase';
  width: number;
  points: MapPoint[];
}

export interface MapScene {
  id: string;
  name: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  freeRoamEnabled: boolean;
  revealRadiusFt: number;
  calibration?: MapCalibration;
  spawnByTokenId?: Record<string, MapPoint>;
  fogStrokes?: MapFogStroke[];
  tokens: Record<string, MapToken>;
  createdAt: number;
  updatedAt: number;
}

export interface SessionMapState {
  activeSceneId?: string;
  scenes: Record<string, MapScene>;
}

export interface CombatAction {
  id: string;
  name: string;
  description: string;
  type: ActionType;
  diceCount?: number;
  diceFace?: number;
  rollMode?: 'attack' | 'damage' | 'utility';
}

export interface CampaignMembership {
  id: string;
  name: string;
  joinedAt: number;
}

export interface CampaignMember {
  id: string;
  name: string;
  userId: string;
  joinedAt: number;
}

export interface Campaign {
  id: string;
  dmId: string;
  name: string;
  inviteCode: string;
  createdAt: number;
  activeSessionCode?: string;
  members?: Record<string, CampaignMember>;
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

export interface DiceRollLog {
  id: string;
  purpose: string;
  notation: string;
  total: number;
  createdAt: number;
}

export interface RPGCharacter {
  id?: string; // Firestore ID
  userId: string; // Owner
  name: string;
  type?: CharacterType; // 'slayer' | 'demon'

  characterClass: string;
  level: number;
  unspentLevelPoints?: number;

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
  activeBuff?: BuffState | null; // Deprecated, use activeBuffs
  activeBuffs?: BuffState[];

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
  diceRollLogs?: DiceRollLog[];
  activeSessionCode?: string; // For persistent session connections
  campaigns?: CampaignMembership[];
  
  // Timestamps
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}
