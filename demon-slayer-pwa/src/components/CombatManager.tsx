import { useState, useEffect } from "react";
import { Sword, Zap, Play, SkipForward, XCircle, EyeOff, Eye } from "lucide-react";
import { GameService } from "../services/gameService";
import { CharacterService } from "../services/characterService";
import type { GameSession } from "../services/gameService";
import type { RPGCharacter } from "../types";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

interface CombatManagerProps {
  session: GameSession;
  sessionCode: string;
}

export function CombatManager({ session, sessionCode }: CombatManagerProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [npcs, setNpcs] = useState<RPGCharacter[]>([]);
  const [loadingNpcs, setLoadingNpcs] = useState(true);
  const [selectedNpcs, setSelectedNpcs] = useState<Set<string>>(new Set());

  const combat = session.combat;
  const players = Object.values(session.players || {});

  useEffect(() => {
    const loadNpcs = async () => {
      if (!user) return;
      try {
        const chars = await CharacterService.getAll(user.uid);
        const npcChars = chars.filter(c => c.type === 'demon' || c.type === 'human');
        setNpcs(npcChars);
      } catch (error) {
        console.error("Failed to load NPCs", error);
      } finally {
        setLoadingNpcs(false);
      }
    };
    loadNpcs();
  }, [user]);

  const handleStartCombat = async () => {
    try {
      await GameService.startCombat(sessionCode);
      showToast("Combat setup started", "success");
    } catch (error) {
      console.error("Failed to start combat", error);
      showToast("Failed to start combat", "error");
    }
  };

  const handleAddNpc = async (npcId: string) => {
    try {
      const npc = npcs.find(n => n.id === npcId);
      if (!npc) return;
      
      await GameService.joinGame(sessionCode, npc);
      
      // Add to combat participants
      await GameService.addToCombat(sessionCode, {
        id: npc.id!,
        name: npc.name,
        type: 'npc',
        photoUrl: npc.photoUrl,
        maxHP: npc.maxHP,
        currentHP: npc.currentHP
      });
      
      showToast(`${npc.name} added to combat`, "success");
      setSelectedNpcs(prev => new Set([...prev, npcId]));
    } catch (error) {
      console.error("Failed to add NPC", error);
      showToast("Failed to add NPC", "error");
    }
  };

  const handleAddPlayer = async (playerId: string) => {
    try {
      const player = players.find(p => p.id === playerId);
      if (!player) return;

      await GameService.addToCombat(sessionCode, {
        id: player.id,
        name: player.name,
        type: 'player',
        photoUrl: player.photoUrl,
        maxHP: player.maxHP,
        currentHP: player.currentHP
      });

      showToast(`${player.name} added to combat`, "success");
    } catch (error) {
      console.error("Failed to add player", error);
      showToast("Failed to add player", "error");
    }
  };

  const handleRollInitiative = async (participantId: string) => {
    try {
      const participant = players.find(p => p.id === participantId);
      if (!participant) return;

      const d20 = Math.floor(Math.random() * 20) + 1;
      const initBonus = participant.initiative || 0;
      const total = d20 + initBonus;

      await GameService.updateInitiative(sessionCode, participantId, total);
      showToast(`${participant.name} rolled ${d20} + ${initBonus} = ${total}`, "info");
    } catch (error) {
      console.error("Failed to roll initiative", error);
    }
  };

  const handleStartTurnBased = async () => {
    try {
      await GameService.startTurnBased(sessionCode);
      showToast("Combat started!", "success");
    } catch (error) {
      console.error("Failed to start turn-based", error);
      showToast("Failed to start combat", "error");
    }
  };

  const handleNextTurn = async () => {
    try {
      await GameService.nextTurn(sessionCode);
    } catch (error) {
      console.error("Failed to advance turn", error);
      showToast("Failed to advance turn", "error");
    }
  };

  const handleEndCombat = async () => {
    try {
      await GameService.endCombat(sessionCode);
      showToast("Combat ended", "info");
    } catch (error) {
      console.error("Failed to end combat", error);
      showToast("Failed to end combat", "error");
    }
  };

  const handleToggleHidden = async (participantId: string) => {
    if (!combat) return;
    
    // TODO: Implement toggle hidden feature
    // This requires adding a method to GameService to update individual participant fields
    showToast("Toggle hidden feature coming soon", "info");
    console.log("Toggle hidden for:", participantId);
  };

  if (!combat) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <div className="text-center py-8">
          <Sword size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-700 mb-2">No Active Combat</h3>
          <p className="text-gray-500 text-sm mb-6">Start a new combat encounter</p>
          <button
            onClick={handleStartCombat}
            className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 transition flex items-center gap-2 mx-auto"
          >
            <Play size={20} /> Start Combat
          </button>
        </div>

        {/* Connected Players */}
        {players.length > 0 && (
          <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200">
            <h4 className="font-bold text-gray-700 mb-3">Connected Players ({players.length})</h4>
            <div className="space-y-2">
              {players.map(player => (
                <div key={player.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    {player.photoUrl && (
                      <img src={player.photoUrl} alt={player.name} className="w-8 h-8 rounded-full object-cover" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{player.name}</div>
                      <div className="text-xs text-gray-500 truncate">Lv.{player.level} • {player.currentHP}/{player.maxHP} HP</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NPC Selection */}
        <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200">
          <h4 className="font-bold text-gray-700 mb-3">Available NPCs</h4>
          {loadingNpcs ? (
            <div className="text-center py-4 text-gray-400">Loading NPCs...</div>
          ) : npcs.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">
              No NPCs created yet. Go to Dashboard → NPCs to create one.
            </div>
          ) : (
            <div className="space-y-2">
              {npcs.map(npc => (
                <div key={npc.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    {npc.photoUrl && (
                      <img src={npc.photoUrl} alt={npc.name} className="w-8 h-8 rounded-full object-cover" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{npc.name}</div>
                      <div className="text-xs text-gray-500 truncate">{npc.characterClass} • Lv.{npc.level}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddNpc(npc.id!)}
                    disabled={selectedNpcs.has(npc.id!)}
                    className="text-xs font-bold bg-gray-900 text-white px-3 py-1 rounded disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    {selectedNpcs.has(npc.id!) ? "Added" : "Add"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Setup Phase
  if (combat.phase === 'setup') {
    const participantsWithInit = combat.participants.filter(p => p.initiative > 0);
    const canStart = participantsWithInit.length === combat.participants.length && combat.participants.length > 0;

    return (
      <div className="space-y-5 sm:space-y-6">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={20} className="text-orange-600" />
            <h3 className="font-bold text-orange-900">Initiative Setup</h3>
          </div>
          <p className="text-sm text-orange-700">Roll initiative for all participants to begin combat.</p>
        </div>

        {/* Participants */}
        <div className="space-y-2">
          <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Combatants ({combat.participants.length})</h4>
          {combat.participants.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No participants added yet. Add players or NPCs below.
            </div>
          ) : (
            combat.participants.map(participant => (
              <div key={participant.id} className="flex items-center justify-between gap-2 p-3 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-3 min-w-0">
                  {participant.photoUrl && (
                    <img src={participant.photoUrl} alt={participant.name} className="w-10 h-10 rounded-full object-cover" />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold truncate">{participant.name}</div>
                    <div className="text-xs text-gray-500">
                      {participant.type === 'player' ? 'Player' : 'NPC'}
                      {participant.isHidden && <span className="ml-2 text-purple-600">(Hidden)</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {participant.initiative > 0 ? (
                    <div className="bg-green-100 text-green-800 px-3 py-1 rounded font-bold text-sm">
                      {participant.initiative}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRollInitiative(participant.id)}
                      className="bg-gray-900 text-white px-3 py-1 rounded text-xs font-bold hover:bg-gray-800"
                    >
                      Roll
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleHidden(participant.id)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    {participant.isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Players */}
        {players.filter(p => !combat.participants.some(cp => cp.id === p.id)).length > 0 && (
          <div className="bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-200">
            <h4 className="font-bold text-blue-900 mb-3 text-sm">Add Connected Players</h4>
            <div className="space-y-2">
              {players.filter(p => !combat.participants.some(cp => cp.id === p.id)).map(player => (
                <div key={player.id} className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    {player.photoUrl && (
                      <img src={player.photoUrl} alt={player.name} className="w-8 h-8 rounded-full object-cover" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{player.name}</div>
                      <div className="text-xs text-gray-500">Lv.{player.level}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddPlayer(player.id)}
                    className="text-xs font-bold bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add NPCs */}
        {npcs.length > 0 && (
          <div className="bg-purple-50 rounded-lg p-3 sm:p-4 border border-purple-200">
            <h4 className="font-bold text-purple-900 mb-3 text-sm">Add NPCs</h4>
            <div className="space-y-2">
              {npcs.filter(npc => !combat.participants.some(cp => cp.id === npc.id)).map(npc => (
                <div key={npc.id} className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    {npc.photoUrl && (
                      <img src={npc.photoUrl} alt={npc.name} className="w-8 h-8 rounded-full object-cover" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{npc.name}</div>
                      <div className="text-xs text-gray-500 truncate">{npc.characterClass} • Lv.{npc.level}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddNpc(npc.id!)}
                    className="text-xs font-bold bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={handleStartTurnBased}
          disabled={!canStart}
          className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          <Play size={20} /> Begin Combat
        </button>
      </div>
    );
  }

  // Active Combat Phase
  const currentParticipant = combat.participants[combat.currentTurnIndex];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Combat HUD */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide opacity-80">Round {combat.round}</div>
            <div className="text-2xl font-bold">{currentParticipant?.name}'s Turn</div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-80">Turn {combat.currentTurnIndex + 1} of {combat.participants.length}</div>
          </div>
        </div>
      </div>

      {/* Turn Order */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
        <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">Turn Order</h4>
        <div className="space-y-2">
          {combat.participants.map((participant, idx) => (
            <div
              key={participant.id}
              className={`flex items-center justify-between gap-2 p-2 rounded-lg transition ${
                idx === combat.currentTurnIndex
                  ? 'bg-red-100 border-2 border-red-500'
                  : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  idx === combat.currentTurnIndex ? 'bg-red-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {idx + 1}
                </div>
                {participant.photoUrl && (
                  <img src={participant.photoUrl} alt={participant.name} className="w-8 h-8 rounded-full object-cover" />
                )}
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{participant.name}</div>
                  <div className="text-xs text-gray-500">Initiative: {participant.initiative}</div>
                </div>
              </div>
              {participant.isHidden && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">Hidden</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={handleNextTurn}
          className="flex-1 bg-gray-900 text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition flex items-center justify-center gap-2"
        >
          <SkipForward size={20} /> Next Turn
        </button>
        <button
          onClick={handleEndCombat}
          className="bg-red-100 text-red-700 px-4 py-3 rounded-lg font-bold hover:bg-red-200 transition flex items-center gap-2"
        >
          <XCircle size={20} /> End
        </button>
      </div>
    </div>
  );
}
