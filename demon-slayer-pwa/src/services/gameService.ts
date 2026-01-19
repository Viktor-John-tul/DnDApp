import { db } from "./firebase";
import { 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  onSnapshot, 
  deleteField,
  collection,
  query,
  where,
  getDocs,
  deleteDoc
} from "firebase/firestore";
import type { RPGCharacter, CombatState } from "../types";

export interface GameSession {
  code: string;
  dmId: string;
  createdAt: number;
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

      // Filter for recent sessions (e.g., created or active within last 3 hours)
      // Note: A real implementation might update a 'lastActive' timestamp on every action.
      // For now, we'll check if the session is reasonably recent (e.g. 24 hours) 
      // AND we rely on the specific "End Session" button to clean up old ones.
      // But adhering to the user's "3 hour" request:
      const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
      const now = Date.now();
      
      const sessions = querySnapshot.docs.map(doc => ({
        code: doc.id,
        ...doc.data()
      })) as GameSession[];

      // Sort by creation time descending (newest first)
      sessions.sort((a, b) => b.createdAt - a.createdAt);
      
      const newestSession = sessions[0];
      
      // If the session is older than 3 hours, strictly speaking we should ignore it
      // UNLESS we add a heartbeat. For now, let's implement the 3 hour cutoff based on creation.
      if (now - newestSession.createdAt < THREE_HOURS_MS) {
        return newestSession.code;
      }
      
      return null;
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
    const playerData: PlayerSyncData = {
      id: charId,
      name: character.name,
      ...(character.type ? { type: character.type } : {}),
      currentHP: character.currentHP,
      maxHP: character.maxHP || character.currentHP,
      currentBreaths: character.currentBreaths,
      maxBreaths: character.maxBreaths,
      level: character.level,
      photoUrl: character.photoUrl,
      initiative: character.customInitiative || 0
    };

    await updateDoc(sessionRef, {
      [`players.${charId}`]: playerData
    });
  },

  // Leave a game
  leaveGame: async (code: string, charId: string) => {
      try {
          const sessionRef = doc(db, "sessions", code);
          await updateDoc(sessionRef, {
              [`players.${charId}`]: deleteField()
          });
      } catch (err) {
          console.error("Error leaving game:", err);
      }
  },

  // Sync character updates
  syncCharacter: async (code: string, character: RPGCharacter) => {
     const sessionRef = doc(db, "sessions", code);
     const charId = character.id || "";
     if (!charId) return; // Should not happen for synced chars

     const playerData: PlayerSyncData = {
      id: charId,
      name: character.name,
      type: character.type,
      currentHP: character.currentHP,
      maxHP: character.maxHP || character.currentHP,
      currentBreaths: character.currentBreaths,
      maxBreaths: character.maxBreaths,
      level: character.level,
      photoUrl: character.photoUrl,
      initiative: character.customInitiative || 0
    };

    await updateDoc(sessionRef, {
      [`players.${charId}`]: playerData
    });
  },

  subscribeToSession: (code: string, callback: (data: GameSession | null) => void) => {
    return onSnapshot(doc(db, "sessions", code), (doc) => {
      if (doc.exists()) {
        callback(doc.data() as GameSession);
      } else {
        callback(null);
      }
    });
  },

  // Combat Methods
  startCombat: async (code: string) => {
    const sessionRef = doc(db, "sessions", code);
    await updateDoc(sessionRef, {
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
        isHidden: participant.type === 'npc' ? false : undefined
      };
      
      await updateDoc(sessionRef, {
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
    
    await updateDoc(sessionRef, {
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
    
    await updateDoc(sessionRef, {
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
      await updateDoc(sessionRef, {
        'combat.currentTurnIndex': 0,
        'combat.round': session.combat.round + 1
      });
    } else {
      await updateDoc(sessionRef, {
        'combat.currentTurnIndex': nextIndex
      });
    }
  },

  endCombat: async (code: string) => {
    const sessionRef = doc(db, "sessions", code);
    await updateDoc(sessionRef, {
      combat: deleteField()
    });
  }
};
