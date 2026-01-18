import { db } from "./firebase";
import { doc, setDoc, updateDoc, getDoc, onSnapshot, deleteField } from "firebase/firestore";
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

  // Sync character updates
  syncCharacter: async (code: string, character: RPGCharacter) => {
     const sessionRef = doc(db, "sessions", code);
     const charId = character.id || "";
     if (!charId) return; // Should not happen for synced chars

     const playerData: PlayerSyncData = {
      id: charId,
      name: character.name,
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

  // Leave game
  leaveGame: async (code: string, playerId: string) => {
    const sessionRef = doc(db, "sessions", code);
    await updateDoc(sessionRef, {
      [`players.${playerId}`]: deleteField()
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
