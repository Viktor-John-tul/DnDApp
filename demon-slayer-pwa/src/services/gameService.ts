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
import type { RPGCharacter } from "../types";

export interface GameSession {
  code: string;
  dmId: string;
  createdAt: number;
  players: Record<string, PlayerSyncData>;
}

export interface PlayerSyncData {
  id: string;
  name: string;
  type?: 'slayer' | 'demon';
  currentHP: number;
  maxHP: number;
  currentBreaths: number;
  maxBreaths: number;
  level: number;
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
      type: character.type,
      currentHP: character.currentHP,
      maxHP: character.maxHP || character.currentHP,
      currentBreaths: character.currentBreaths,
      maxBreaths: character.maxBreaths,
      level: character.level
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
      level: character.level
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
  }
};
