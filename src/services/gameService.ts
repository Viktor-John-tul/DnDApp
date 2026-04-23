import { db } from "./firebase";
import { 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  onSnapshot, 
  deleteField,
  runTransaction,
  type DocumentReference,
  collection,
  query,
  where,
  getDocs,
  deleteDoc
} from "firebase/firestore";
import type { RPGCharacter, CombatState, MapCalibration, MapFogStroke, MapPoint, MapScene, MapToken, SessionMapState } from "../types";
import { Calculator, resolveEquippedSpecialItemBonuses } from "./rules";
import { getEffectiveMaxBreaths } from "./slayerProgression";
import { getSlayerBaseSpeed } from "./slayerProgression";

export const SESSION_INACTIVITY_MS = 3 * 60 * 60 * 1000;

export interface GameSession {
  code: string;
  dmId: string;
  createdAt: number;
  lastActive?: number;
  players: Record<string, PlayerSyncData>;
  combat?: CombatState;
  map?: SessionMapState;
}

interface CreateMapSceneInput {
  name: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  revealRadiusFt?: number;
}

interface MapMoveResult {
  clamped: boolean;
  remainingMovementFt?: number;
  movedDistancePx: number;
}

export interface PlayerSyncData {
  id: string;
  userId: string;
  name: string;
  type?: 'slayer' | 'demon' | 'human';
  currentHP: number;
  maxHP: number;
  currentBreaths: number;
  maxBreaths: number;
  level: number;
  photoUrl?: string | null;
  initiative?: number;
  speedFt?: number;
}

const buildPlayerSyncData = (character: RPGCharacter): PlayerSyncData => {
  const itemBonuses = resolveEquippedSpecialItemBonuses(character.inventory || []);
  const effectiveDexterity = character.dexterity + itemBonuses.attributeBonuses.dexterity;
  const effectiveConstitution = character.constitution + itemBonuses.attributeBonuses.constitution;
  const baseInitiative = character.customInitiative ?? Calculator.getModifier(effectiveDexterity);
  const baseMaxHP = character.customMaxHP ?? Calculator.getMaxHP(effectiveConstitution, character.level);
  const maxHP = Math.max(1, baseMaxHP + itemBonuses.maxHPBonus);
  const baseSpeed = character.customSpeed
    ?? (character.type === 'slayer' ? getSlayerBaseSpeed(character.level) : 30);
  const speedFt = Math.max(0, baseSpeed + itemBonuses.speedBonus);

  return {
    id: character.id || "unknown_" + Date.now(),
    userId: character.userId,
    name: character.name,
    ...(character.type ? { type: character.type } : {}),
    currentHP: Math.min(character.currentHP, maxHP),
    maxHP,
    currentBreaths: character.currentBreaths,
    maxBreaths: getEffectiveMaxBreaths(character),
    level: character.level,
    photoUrl: character.photoUrl,
    initiative: baseInitiative + itemBonuses.initiativeBonus,
    speedFt
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

const emptyMapState = (): SessionMapState => ({
  scenes: {},
});

const getCurrentTurnKey = (session: GameSession) => {
  if (!session.combat?.isActive) return undefined;
  return `${session.combat.round}:${session.combat.currentTurnIndex}`;
};

const getPixelsPerFoot = (scene: MapScene) => {
  if (scene.calibration?.pixelsPerFoot && scene.calibration.pixelsPerFoot > 0) {
    return scene.calibration.pixelsPerFoot;
  }
  return 10;
};

const getDistance = (a: MapPoint, b: MapPoint) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const clampPointToRadius = (origin: MapPoint, target: MapPoint, maxDistance: number): { point: MapPoint; clamped: boolean } => {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= maxDistance || maxDistance <= 0) {
    return { point: target, clamped: false };
  }

  const ratio = maxDistance / distance;
  return {
    point: {
      x: origin.x + dx * ratio,
      y: origin.y + dy * ratio,
    },
    clamped: true,
  };
};

const resolveTokenSpeedFt = (token: MapToken) => {
  if (token.movementMode === 'unlimited') return Number.POSITIVE_INFINITY;
  const base = token.speedFt ?? 30;
  const modifier = (token.speedModifiers || []).reduce((sum, entry) => sum + (entry.amountFt || 0), 0);
  return Math.max(0, base + modifier);
};

const resetCurrentTurnTokenMovement = (session: GameSession) => {
  const map = session.map;
  const combat = session.combat;
  if (!map?.activeSceneId || !combat?.isActive) return map;

  const activeParticipant = combat.participants[combat.currentTurnIndex];
  if (!activeParticipant) return map;

  const scene = map.scenes[map.activeSceneId];
  if (!scene) return map;

  const token = Object.values(scene.tokens).find(
    (candidate) => candidate.ownerCharacterId === activeParticipant.id
  );

  if (!token) return map;

  const nextToken = {
    ...token,
    remainingMovementFt: resolveTokenSpeedFt(token),
    lastMove: undefined,
    updatedAt: Date.now(),
  };

  map.scenes[map.activeSceneId] = {
    ...scene,
    tokens: {
      ...scene.tokens,
      [token.id]: nextToken,
    },
    updatedAt: Date.now(),
  };

  return map;
};

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

    const updatedSession: GameSession = {
      ...session,
      combat: {
        ...session.combat,
        isActive: true,
        phase: 'active',
        round: 1,
        currentTurnIndex: 0,
        participants: sortedParticipants,
      },
    };
    const nextMap = resetCurrentTurnTokenMovement(updatedSession);

    await touchSession(sessionRef, {
      'combat.isActive': true,
      'combat.phase': 'active',
      'combat.round': 1,
      'combat.currentTurnIndex': 0,
      'combat.participants': sortedParticipants,
      ...(nextMap ? { map: nextMap } : {})
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
      const updatedSession: GameSession = {
        ...session,
        combat: {
          ...session.combat,
          currentTurnIndex: 0,
          round: session.combat.round + 1,
        },
      };
      const nextMap = resetCurrentTurnTokenMovement(updatedSession);

      await touchSession(sessionRef, {
        'combat.currentTurnIndex': 0,
        'combat.round': session.combat.round + 1,
        ...(nextMap ? { map: nextMap } : {})
      });
    } else {
      const updatedSession: GameSession = {
        ...session,
        combat: {
          ...session.combat,
          currentTurnIndex: nextIndex,
        },
      };
      const nextMap = resetCurrentTurnTokenMovement(updatedSession);

      await touchSession(sessionRef, {
        'combat.currentTurnIndex': nextIndex,
        ...(nextMap ? { map: nextMap } : {})
      });
    }
  },

  endCombat: async (code: string) => {
    const sessionRef = doc(db, "sessions", code);
    await touchSession(sessionRef, {
      combat: deleteField()
    });
  },

  createMapScene: async (code: string, input: CreateMapSceneInput) => {
    const sessionRef = doc(db, "sessions", code);
    const sceneId = crypto.randomUUID();
    const now = Date.now();

    await runTransaction(db, async (transaction) => {
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists()) {
        throw new Error("Session not found");
      }

      const session = sessionSnap.data() as GameSession;
      const map = session.map || emptyMapState();
      const scene: MapScene = {
        id: sceneId,
        name: input.name,
        imageUrl: input.imageUrl,
        imageWidth: input.imageWidth,
        imageHeight: input.imageHeight,
        freeRoamEnabled: true,
        revealRadiusFt: input.revealRadiusFt ?? 30,
        tokens: {},
        createdAt: now,
        updatedAt: now,
      };

      map.scenes[sceneId] = scene;
      if (!map.activeSceneId) {
        map.activeSceneId = sceneId;
      }

      transaction.update(sessionRef, {
        map,
        lastActive: now,
      });
    });

    return sceneId;
  },

  setActiveMapScene: async (code: string, sceneId: string) => {
    const sessionRef = doc(db, "sessions", code);

    await runTransaction(db, async (transaction) => {
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists()) throw new Error("Session not found");

      const session = sessionSnap.data() as GameSession;
      const map = session.map || emptyMapState();
      const nextScene = map.scenes[sceneId];

      if (!nextScene) {
        throw new Error("Scene not found");
      }

      const nextTokens = Object.fromEntries(
        Object.entries(nextScene.tokens).map(([tokenId, token]) => {
          const spawn = nextScene.spawnByTokenId?.[tokenId];
          if (!spawn) return [tokenId, token];
          return [
            tokenId,
            {
              ...token,
              position: spawn,
              updatedAt: Date.now(),
            },
          ];
        })
      );

      map.scenes[sceneId] = {
        ...nextScene,
        tokens: nextTokens,
        updatedAt: Date.now(),
      };
      map.activeSceneId = sceneId;

      transaction.update(sessionRef, {
        map,
        lastActive: Date.now(),
      });
    });
  },

  setMapSceneFreeRoam: async (code: string, sceneId: string, freeRoamEnabled: boolean) => {
    const sessionRef = doc(db, "sessions", code);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");

    const session = sessionSnap.data() as GameSession;
    const map = session.map || emptyMapState();
    const scene = map.scenes[sceneId];
    if (!scene) throw new Error("Scene not found");

    map.scenes[sceneId] = {
      ...scene,
      freeRoamEnabled,
      updatedAt: Date.now(),
    };

    await touchSession(sessionRef, { map });
  },

  setMapSceneCalibration: async (code: string, sceneId: string, calibration: MapCalibration) => {
    const sessionRef = doc(db, "sessions", code);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");

    const session = sessionSnap.data() as GameSession;
    const map = session.map || emptyMapState();
    const scene = map.scenes[sceneId];
    if (!scene) throw new Error("Scene not found");

    map.scenes[sceneId] = {
      ...scene,
      calibration,
      updatedAt: Date.now(),
    };

    await touchSession(sessionRef, { map });
  },

  setMapSceneRevealRadius: async (code: string, sceneId: string, revealRadiusFt: number) => {
    const sessionRef = doc(db, "sessions", code);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");

    const session = sessionSnap.data() as GameSession;
    const map = session.map || emptyMapState();
    const scene = map.scenes[sceneId];
    if (!scene) throw new Error("Scene not found");

    map.scenes[sceneId] = {
      ...scene,
      revealRadiusFt: Math.max(1, revealRadiusFt),
      updatedAt: Date.now(),
    };

    await touchSession(sessionRef, { map });
  },

  setMapSceneSpawnPoint: async (code: string, sceneId: string, tokenId: string, point: MapPoint) => {
    const sessionRef = doc(db, "sessions", code);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");

    const session = sessionSnap.data() as GameSession;
    const map = session.map || emptyMapState();
    const scene = map.scenes[sceneId];
    if (!scene) throw new Error("Scene not found");

    map.scenes[sceneId] = {
      ...scene,
      spawnByTokenId: {
        ...(scene.spawnByTokenId || {}),
        [tokenId]: point,
      },
      updatedAt: Date.now(),
    };

    await touchSession(sessionRef, { map });
  },

  clearMapSceneSpawnPoint: async (code: string, sceneId: string, tokenId: string) => {
    const sessionRef = doc(db, "sessions", code);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");

    const session = sessionSnap.data() as GameSession;
    const map = session.map || emptyMapState();
    const scene = map.scenes[sceneId];
    if (!scene) throw new Error("Scene not found");

    const nextSpawnByTokenId = { ...(scene.spawnByTokenId || {}) };
    delete nextSpawnByTokenId[tokenId];

    map.scenes[sceneId] = {
      ...scene,
      spawnByTokenId: nextSpawnByTokenId,
      updatedAt: Date.now(),
    };

    await touchSession(sessionRef, { map });
  },

  appendMapFogStroke: async (code: string, sceneId: string, stroke: MapFogStroke) => {
    const sessionRef = doc(db, "sessions", code);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");

    const session = sessionSnap.data() as GameSession;
    const map = session.map || emptyMapState();
    const scene = map.scenes[sceneId];
    if (!scene) throw new Error("Scene not found");

    map.scenes[sceneId] = {
      ...scene,
      fogStrokes: [...(scene.fogStrokes || []), stroke],
      updatedAt: Date.now(),
    };

    await touchSession(sessionRef, { map });
  },

  clearMapFogStrokes: async (code: string, sceneId: string) => {
    const sessionRef = doc(db, "sessions", code);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");

    const session = sessionSnap.data() as GameSession;
    const map = session.map || emptyMapState();
    const scene = map.scenes[sceneId];
    if (!scene) throw new Error("Scene not found");

    map.scenes[sceneId] = {
      ...scene,
      fogStrokes: [],
      updatedAt: Date.now(),
    };

    await touchSession(sessionRef, { map });
  },

  undoLastMapFogStroke: async (code: string, sceneId: string) => {
    const sessionRef = doc(db, "sessions", code);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");

    const session = sessionSnap.data() as GameSession;
    const map = session.map || emptyMapState();
    const scene = map.scenes[sceneId];
    if (!scene) throw new Error("Scene not found");

    const fogStrokes = [...(scene.fogStrokes || [])];
    if (fogStrokes.length === 0) return;
    fogStrokes.pop();

    map.scenes[sceneId] = {
      ...scene,
      fogStrokes,
      updatedAt: Date.now(),
    };

    await touchSession(sessionRef, { map });
  },

  setAllSceneSpawnsFromCurrentTokens: async (code: string, sceneId: string) => {
    const sessionRef = doc(db, "sessions", code);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");

    const session = sessionSnap.data() as GameSession;
    const map = session.map || emptyMapState();
    const scene = map.scenes[sceneId];
    if (!scene) throw new Error("Scene not found");

    const spawnByTokenId = Object.fromEntries(
      Object.entries(scene.tokens || {}).map(([tokenId, token]) => [tokenId, token.position])
    );

    map.scenes[sceneId] = {
      ...scene,
      spawnByTokenId,
      updatedAt: Date.now(),
    };

    await touchSession(sessionRef, { map });
  },

  upsertMapToken: async (code: string, sceneId: string, token: Omit<MapToken, 'createdAt' | 'updatedAt'>) => {
    const sessionRef = doc(db, "sessions", code);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");

    const session = sessionSnap.data() as GameSession;
    const map = session.map || emptyMapState();
    const scene = map.scenes[sceneId];
    if (!scene) throw new Error("Scene not found");

    const previous = scene.tokens[token.id];
    const now = Date.now();
    scene.tokens[token.id] = {
      ...token,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
    };
    scene.updatedAt = now;

    await touchSession(sessionRef, { map });
  },

  moveMapToken: async (code: string, actorUserId: string, tokenId: string, target: MapPoint): Promise<MapMoveResult> => {
    const sessionRef = doc(db, "sessions", code);

    return runTransaction(db, async (transaction) => {
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists()) throw new Error("Session not found");

      const session = sessionSnap.data() as GameSession;
      const map = session.map;
      if (!map?.activeSceneId) throw new Error("No active map scene");

      const scene = map.scenes[map.activeSceneId];
      if (!scene) throw new Error("Active scene not found");

      const token = scene.tokens[tokenId];
      if (!token) throw new Error("Token not found");

      const isDM = session.dmId === actorUserId;
      const ownsToken = token.ownerUserId === actorUserId;
      if (!isDM && !ownsToken) {
        throw new Error("You cannot move this token");
      }
      if (token.isLocked && !isDM) {
        throw new Error("Token is locked by DM");
      }

      const inCombat = !!session.combat?.isActive;
      const currentTurnKey = getCurrentTurnKey(session);
      const isMyTurn = inCombat
        ? session.combat?.participants[session.combat.currentTurnIndex]?.id === token.ownerCharacterId
        : true;

      if (!inCombat && !scene.freeRoamEnabled && !isDM) {
        throw new Error("Free-roam is disabled by the DM");
      }

      if (inCombat && !isMyTurn && !isDM) {
        throw new Error("You can move only on your turn");
      }

      let nextPoint = target;
      let clamped = false;
      let movedDistancePx = getDistance(token.position, target);
      let remaining = token.remainingMovementFt;

      if (inCombat && token.movementMode !== 'unlimited') {
        const pixelsPerFoot = getPixelsPerFoot(scene);
        const movementBudgetFt = typeof token.remainingMovementFt === 'number'
          ? token.remainingMovementFt
          : resolveTokenSpeedFt(token);
        const maxDistancePx = movementBudgetFt * pixelsPerFoot;
        const clampedResult = clampPointToRadius(token.position, target, maxDistancePx);
        nextPoint = clampedResult.point;
        clamped = clampedResult.clamped;
        movedDistancePx = getDistance(token.position, nextPoint);
        const movedFt = movedDistancePx / pixelsPerFoot;
        remaining = Math.max(0, movementBudgetFt - movedFt);
      }

      scene.tokens[tokenId] = {
        ...token,
        position: nextPoint,
        remainingMovementFt: remaining,
        lastMove: {
          position: token.position,
          remainingMovementFt: token.remainingMovementFt,
          at: Date.now(),
          byUserId: actorUserId,
          turnKey: currentTurnKey,
        },
        updatedAt: Date.now(),
      };
      scene.updatedAt = Date.now();

      transaction.update(sessionRef, {
        map,
        lastActive: Date.now(),
      });

      return {
        clamped,
        remainingMovementFt: remaining,
        movedDistancePx,
      };
    });
  },

  undoTokenMove: async (code: string, actorUserId: string, tokenId: string) => {
    const sessionRef = doc(db, "sessions", code);

    await runTransaction(db, async (transaction) => {
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists()) throw new Error("Session not found");

      const session = sessionSnap.data() as GameSession;
      const map = session.map;
      if (!map?.activeSceneId) throw new Error("No active map scene");

      const scene = map.scenes[map.activeSceneId];
      if (!scene) throw new Error("Active scene not found");

      const token = scene.tokens[tokenId];
      if (!token?.lastMove) throw new Error("No move to undo");

      const isDM = session.dmId === actorUserId;
      const ownsToken = token.ownerUserId === actorUserId;
      if (!isDM && !ownsToken) throw new Error("You cannot undo this token move");

      const currentTurnKey = getCurrentTurnKey(session);
      if (session.combat?.isActive && token.lastMove.turnKey && token.lastMove.turnKey !== currentTurnKey) {
        throw new Error("Undo window expired");
      }

      scene.tokens[tokenId] = {
        ...token,
        position: token.lastMove.position,
        remainingMovementFt: token.lastMove.remainingMovementFt,
        lastMove: undefined,
        updatedAt: Date.now(),
      };
      scene.updatedAt = Date.now();

      transaction.update(sessionRef, {
        map,
        lastActive: Date.now(),
      });
    });
  }
};
