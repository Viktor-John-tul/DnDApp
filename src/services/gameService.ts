import { db } from "./firebase";
import { 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  onSnapshot, 
  deleteField,
  type DocumentReference,
  collection,
  query,
  where,
  getDocs,
  deleteDoc
} from "firebase/firestore";
import type { RPGCharacter, CombatState } from "../types";
import { Calculator, resolveEquippedSpecialItemBonuses } from "./rules";
import { getEffectiveMaxBreaths } from "./slayerProgression";

export const SESSION_INACTIVITY_MS = 3 * 60 * 60 * 1000;

export interface GameSession {
  code: string;
  dmId: string;
  createdAt: number;
  lastActive?: number;
  players: Record<string, PlayerSyncData>;
  combat?: CombatState;
}

export interface PlayerSyncData {
  id: string;
  name: string;
  type?: 'slayer' | 'demon' | 'human';
  currentHP: number;
  maxHP: number;
  currentBreaths: number;
  maxBreaths: number;
  level: number;
  photoUrl?: string | null;
  initiative?: number;
}

const buildPlayerSyncData = (character: RPGCharacter): PlayerSyncData => {
  const itemBonuses = resolveEquippedSpecialItemBonuses(character.inventory || []);
  const effectiveDexterity = character.dexterity + itemBonuses.attributeBonuses.dexterity;
  const effectiveConstitution = character.constitution + itemBonuses.attributeBonuses.constitution;
  const baseInitiative = character.customInitiative ?? Calculator.getModifier(effectiveDexterity);
  const baseMaxHP = character.customMaxHP ?? Calculator.getMaxHP(effectiveConstitution, character.level);
  const maxHP = Math.max(1, baseMaxHP + itemBonuses.maxHPBonus);

  return {
    id: character.id || "unknown_" + Date.now(),
    name: character.name,
    ...(character.type ? { type: character.type } : {}),
    currentHP: Math.min(character.currentHP, maxHP),
    maxHP,
    currentBreaths: character.currentBreaths,
    maxBreaths: getEffectiveMaxBreaths(character),
    level: character.level,
    photoUrl: character.photoUrl,
    initiative: baseInitiative + itemBonuses.initiativeBonus
  };
};

const getSessionActivityTime = (session: Pick<GameSession, 'createdAt' | 'lastActive'>) => session.lastActive ?? session.createdAt;

const isSessionExpired = (session: Pick<GameSession, 'createdAt' | 'lastActive'>, now = Date.now()) =>
  now - getSessionActivityTime(session) >= SESSION_INACTIVITY_MS;

const touchSession = (sessionRef: DocumentReference, updates: Record<string, unknown>) =>
  updateDoc(sessionRef, {
    ...updates,
    lastActive: Date.now()
  });

export const GameService = {
  // Generate a random 6-character code
  generateCode: () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  },

  // Find an active session for the DM
  resumeSession: async (dmId: string): Promise<string | null> => {
    try {
      // Find sessions by this DM
      const q = query(collection(db, "sessions"), where("dmId", "==", dmId));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) return null;

      // Filter for sessions that are still active within the inactivity window.
      const now = Date.now();
      
      const sessions = querySnapshot.docs.map(doc => ({
        code: doc.id,
        ...doc.data()
      })) as GameSession[];

      const activeSessions = sessions.filter((session) => !isSessionExpired(session, now));
      const expiredSessions = sessions.filter((session) => isSessionExpired(session, now));

      if (expiredSessions.length > 0) {
        await Promise.allSettled(expiredSessions.map((session) => GameService.endSession(session.code)));
      }

      // Sort by creation time descending (newest first)
      activeSessions.sort((a, b) => getSessionActivityTime(b) - getSessionActivityTime(a));
      
      const newestSession = activeSessions[0];

      if (!newestSession) return null;
      
      return newestSession.code;
    } catch (error) {
      console.error("Error resuming session:", error);
      return null;
    }
  },

  // End a session
  endSession: async (code: string) => {
    await deleteDoc(doc(db, "sessions", code));
  },

  checkIsDM: async (code: string, userId: string): Promise<boolean> => {
      try {
          const snap = await getDoc(doc(db, "sessions", code));
          if (!snap.exists()) return false;
          return snap.data().dmId === userId;
      } catch {
          return false;
      }
  },

  // Host a new game
  createGame: async (dmId: string): Promise<string> => {
    const code = GameService.generateCode();
    await setDoc(doc(db, "sessions", code), {
      code,
      dmId,
      createdAt: Date.now(),
      lastActive: Date.now(),
      players: {}
    });
    return code;
  },

  // Join a game
  joinGame: async (code: string, character: RPGCharacter) => {
    const sessionRef = doc(db, "sessions", code);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
      throw new Error("Game session not found");
    }

    const charId = character.id || "unknown_" + Date.now();
    const playerData = buildPlayerSyncData({ ...character, id: charId });

    await touchSession(sessionRef, {
      [`players.${charId}`]: playerData
    });
  },

  // Leave a game
  leaveGame: async (code: string, charId: string) => {
      try {
          const sessionRef = doc(db, "sessions", code);
        const sessionSnap = await getDoc(sessionRef);
        if (!sessionSnap.exists()) return;

        const session = sessionSnap.data() as GameSession;
        const remainingParticipants = session.combat?.participants.filter((participant) => participant.id !== charId);
        const updates: Record<string, unknown> = {
          [`players.${charId}`]: deleteField()
        };

        if (remainingParticipants) {
          updates['combat.participants'] = remainingParticipants;
        }

        await touchSession(sessionRef, updates);
      } catch (err) {
          console.error("Error leaving game:", err);
      }
  },

  // Sync character updates
  syncCharacter: async (code: string, character: RPGCharacter) => {
     const sessionRef = doc(db, "sessions", code);
     const charId = character.id || "";
     if (!charId) return; // Should not happen for synced chars

     const playerData = buildPlayerSyncData(character);

    await touchSession(sessionRef, {
      [`players.${charId}`]: playerData
    });
  },

  subscribeToSession: (code: string, callback: (data: GameSession | null) => void) => {
    return onSnapshot(doc(db, "sessions", code), (doc) => {
      if (doc.exists()) {
        const session = doc.data() as GameSession;
        if (isSessionExpired(session)) {
          GameService.endSession(code).catch((error) => console.error("Failed to auto-end inactive session", error));
          callback(null);
          return;
        }

        callback(session);
      } else {
        callback(null);
      }
    });
  },

  // Combat Methods
  startCombat: async (code: string) => {
    const sessionRef = doc(db, "sessions", code);
    await touchSession(sessionRef, {
      combat: {
        isActive: false,
        phase: 'setup',
        round: 0,
        currentTurnIndex: 0,
        participants: []
      }
    });
  },

  addToCombat: async (code: string, participant: { id: string, name: string, type: 'player' | 'npc', photoUrl?: string | null, maxHP?: number, currentHP?: number }) => {
    try {
      const sessionRef = doc(db, "sessions", code);
      const sessionSnap = await getDoc(sessionRef);
      
      if (!sessionSnap.exists()) {
        throw new Error("Session not found");
      }
      
      const session = sessionSnap.data() as GameSession;
      if (!session.combat) {
        throw new Error("Combat not started");
      }
      
      // Check if already in combat
      if (session.combat.participants.some(p => p.id === participant.id)) {
        console.log("Participant already in combat");
        return;
      }
      
      const newParticipant = {
        id: participant.id,
        name: participant.name,
        type: participant.type,
        photoUrl: participant.photoUrl || null,
        maxHP: participant.maxHP,
        currentHP: participant.currentHP,
        initiative: 0,
        ...(participant.type === 'npc' ? { isHidden: false } : {})
      };
      
      await touchSession(sessionRef, {
        'combat.participants': [...session.combat.participants, newParticipant]
      });
    } catch (error) {
      console.error("Error in addToCombat:", error);
      throw error;
    }
  },

  updateInitiative: async (code: string, participantId: string, initiative: number) => {
    const sessionRef = doc(db, "sessions", code);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) return;
    
    const session = sessionSnap.data() as GameSession;
    if (!session.combat) return;
    
    const participants = session.combat.participants.map(p => 
      p.id === participantId ? { ...p, initiative } : p
    );
    
    await touchSession(sessionRef, {
      'combat.participants': participants
    });
  },

  startTurnBased: async (code: string) => {
    const sessionRef = doc(db, "sessions", code);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) return;
    
    const session = sessionSnap.data() as GameSession;
    if (!session.combat) return;
    
    // Sort participants by initiative (highest first)
    const sortedParticipants = [...session.combat.participants].sort((a, b) => b.initiative - a.initiative);
    
    await touchSession(sessionRef, {
      'combat.isActive': true,
      'combat.phase': 'active',
      'combat.round': 1,
      'combat.currentTurnIndex': 0,
      'combat.participants': sortedParticipants
    });
  },

  nextTurn: async (code: string) => {
    const sessionRef = doc(db, "sessions", code);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) return;
    
    const session = sessionSnap.data() as GameSession;
    if (!session.combat || !session.combat.isActive) return;
    
    const nextIndex = session.combat.currentTurnIndex + 1;
    const participantCount = session.combat.participants.length;
    
    if (nextIndex >= participantCount) {
      // New round
      await touchSession(sessionRef, {
        'combat.currentTurnIndex': 0,
        'combat.round': session.combat.round + 1
      });
    } else {
      await touchSession(sessionRef, {
        'combat.currentTurnIndex': nextIndex
      });
    }
  },

  endCombat: async (code: string) => {
    const sessionRef = doc(db, "sessions", code);
    await touchSession(sessionRef, {
      combat: deleteField()
    });
  }
};
