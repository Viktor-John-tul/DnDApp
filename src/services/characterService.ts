import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where,
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";
import { db } from "./firebase";
import type { RPGCharacter } from "../types";

const COLLECTION = "characters";
const MOCK_SUBSCRIBERS = new Set<(char: RPGCharacter | null) => void>();

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const stripUndefinedDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined) as T;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefinedDeep(entry)])
    ) as T;
  }

  return value;
};

const cloneMockCharacter = (): RPGCharacter => JSON.parse(JSON.stringify(MOCK_CHARACTER)) as RPGCharacter;

const notifyMockSubscribers = () => {
  const snapshot = cloneMockCharacter();
  MOCK_SUBSCRIBERS.forEach((callback) => callback(snapshot));
};

// --- MOCK DATA FOR DEV MODE ---
const MOCK_CHARACTER: RPGCharacter = {
  id: "mock_char_1",
  userId: "dev_user_123",
  name: "Tanjiro Kamado (Demo)",
  characterClass: "Demon Slayer",
  level: 3,
  strength: 14,
  dexterity: 16,
  constitution: 15,
  intelligence: 12,
  wisdom: 14,
  charisma: 13,
  proficientSkills: ["Athletics", "Acrobatics", "Insight"],
  proficientSavingThrows: ["DEX", "STR"],
  photoUrl: null,
  breathingStyleName: "Water Breathing",
  breathingForms: [
    {
      id: "form_1",
      name: "1st Form: Water Surface Slash",
      description: "A powerful single concentrated slash.",
      requiresAttackRoll: true,
      durationRounds: 0,
      diceCount: 2,
      diceFace: 8,
      spCost: 3,
      effectType: 'damage'
    }
  ],
  currentBreaths: 100,
  maxBreaths: 100,
  currentOverdraftDC: 10,
  currentHP: 24,
  maxHP: 24,
  healingSurges: 3,
  deathSaveSuccesses: 0,
  deathSaveFailures: 0,
  gold: 50,
  inventory: [
    { id: "item_1", name: "Nichirin Sword", description: "Blue blade", quantity: 1, weight: 3 }
  ],
  customActions: [],
  activeBuff: { activeBuffFormID: null, activeBuffName: null, activeBuffDiceCount: null, activeBuffDiceFace: null, activeBuffRoundsRemaining: null },
  age: "15",
  height: "5'5",
  weight: "135lbs",
  eyes: "Dark Red",
  skin: "Fair",
  hair: "Burgundy",
  personalityTraits: "Kind, Determined",
  ideals: "Protects sister at all costs",
  bonds: "Nezuko",
  flaws: "Head is too hard",
  backstory: "Family killed by demons...",
  notes: "",
  campaigns: [],
  createdAt: Date.now(),
  updatedAt: Date.now()
};

export const CharacterService = {
  async create(character: Omit<RPGCharacter, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
        const safeCharacter = stripUndefinedDeep(character);
        const docRef = await addDoc(collection(db, COLLECTION), {
        ...safeCharacter,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
        });
        return docRef.id;
    } catch (e) {
        console.warn("Firestore create failed (Dev Mode?), returning mock ID");
        return "mock_char_new_" + Date.now();
    }
  },

  async getAll(userId: string) {
    // FORCE RETURN MOCK IF DEV USER
    if (userId === 'dev_user_123') {
        return [cloneMockCharacter()];
    }

    try {
        const q = query(collection(db, COLLECTION), where("userId", "==", userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RPGCharacter));
    } catch (e) {
        console.warn("Firestore getAll failed (Dev Mode?), returning mock list");
        return [MOCK_CHARACTER];
    }
  },

  async get(id: string) {
    // FORCE RETURN MOCK IF DEV
    if (id === 'mock_char_1' || id.startsWith('mock_')) {
      return cloneMockCharacter();
    }

    try {
        const docRef = doc(db, COLLECTION, id);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) return null;
        return { id: snapshot.id, ...snapshot.data() } as RPGCharacter;
    } catch (e) {
        console.warn("Firestore get failed (Dev Mode?), returning mock char");
        return MOCK_CHARACTER;
    }
  },

  async update(id: string, updates: Partial<RPGCharacter>) {
    if (id === 'mock_char_1' || id.startsWith('mock_')) {
        // Mock Update
        Object.assign(MOCK_CHARACTER, stripUndefinedDeep(updates));
      notifyMockSubscribers();
        return;
    }
    
    try {
        const docRef = doc(db, COLLECTION, id);
        const safeUpdates = stripUndefinedDeep(updates);
        await updateDoc(docRef, {
        ...safeUpdates,
        updatedAt: serverTimestamp()
        });
    } catch (e) {
        console.warn("Firestore update failed (Dev Mode?)", e);
    }
  },

  async delete(id: string) {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  subscribe(id: string, callback: (char: RPGCharacter | null) => void) {
      if (id === 'mock_char_1' || id.startsWith('mock_')) {
        MOCK_SUBSCRIBERS.add(callback);
        callback(cloneMockCharacter());
        return () => {
          MOCK_SUBSCRIBERS.delete(callback);
        };
      }
      
      const docRef = doc(db, COLLECTION, id);
      const unsubscribe = onSnapshot(docRef, (doc) => {
          if (doc.exists()) {
              callback({ id: doc.id, ...doc.data() } as RPGCharacter);
          } else {
              callback(null);
          }
      });
      return unsubscribe;
  }
};
