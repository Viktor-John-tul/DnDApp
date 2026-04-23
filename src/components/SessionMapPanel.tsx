import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Lock, LockOpen, RotateCcw, Plus } from "lucide-react";
import { GameService } from "../services/gameService";
import type { GameSession } from "../services/gameService";
import type { MapMovementMode, MapPoint, MapToken } from "../types";
import { useToast } from "../context/ToastContext";

interface Props {
  session?: GameSession | null;
  sessionCode?: string;
  actorUserId?: string;
  isDM?: boolean;
  allowMarkerCreation?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function SessionMapPanel({
  session,
  sessionCode,
  actorUserId,
  isDM = false,
  allowMarkerCreation = true,
}: Props) {
  const { showToast } = useToast();
  const mapState = session?.map;
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
  const [dragPoint, setDragPoint] = useState<MapPoint | null>(null);

  const [newMarkerLabel, setNewMarkerLabel] = useState("Marker");
  const [newMarkerMode, setNewMarkerMode] = useState<MapMovementMode>("unlimited");
  const [newMarkerSpeed, setNewMarkerSpeed] = useState(30);
  const [newMarkerColor, setNewMarkerColor] = useState("#22c55e");

  const viewportRef = useRef<HTMLDivElement | null>(null);

  const activeScene = useMemo(() => {
    if (!mapState?.activeSceneId) return undefined;
    return mapState.scenes[mapState.activeSceneId];
  }, [mapState]);

  const tokens = useMemo(() => {
    if (!activeScene) return [] as MapToken[];
    return Object.values(activeScene.tokens || {});
  }, [activeScene]);

  const selectedToken = selectedTokenId
    ? tokens.find((token) => token.id === selectedTokenId)
    : undefined;

  const canMoveToken = (token: MapToken) => {
    if (!actorUserId) return false;
    if (isDM) return true;
    if (token.isLocked) return false;
    return token.ownerUserId === actorUserId;
  };

  const canEditToken = (token: MapToken) => {
    if (!actorUserId) return false;
    if (isDM) return true;
    return token.ownerUserId === actorUserId;
  };

  const toScenePoint = (event: ReactPointerEvent) => {
    if (!activeScene || !viewportRef.current) return null;
    const rect = viewportRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const px = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const py = clamp((event.clientY - rect.top) / rect.height, 0, 1);

    return {
      x: px * activeScene.imageWidth,
      y: py * activeScene.imageHeight,
    };
  };

  const handleTokenPointerDown = (event: ReactPointerEvent, token: MapToken) => {
    if (!canMoveToken(token)) return;
    event.preventDefault();
    setSelectedTokenId(token.id);
    setDraggingTokenId(token.id);
    setDragPoint(token.position);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handleViewportPointerMove = (event: ReactPointerEvent) => {
    if (!draggingTokenId) return;
    const point = toScenePoint(event);
    if (!point) return;
    setDragPoint(point);
  };

  const handleViewportPointerUp = async (event: ReactPointerEvent) => {
    if (!draggingTokenId || !sessionCode || !actorUserId) return;
    const point = toScenePoint(event);
    const tokenId = draggingTokenId;
    setDraggingTokenId(null);

    if (!point) {
      setDragPoint(null);
      return;
    }

    setBusy(true);
    try {
      const result = await GameService.moveMapToken(sessionCode, actorUserId, tokenId, point);
      if (result.clamped) {
        showToast("Movement clamped to remaining speed", "info");
      }
    } catch (error) {
      console.error("Failed to move token", error);
      showToast("Failed to move token", "error");
    } finally {
      setBusy(false);
      setDragPoint(null);
    }
  };

  const handleUndo = async () => {
    if (!sessionCode || !actorUserId || !selectedToken) return;
    setBusy(true);
    try {
      await GameService.undoTokenMove(sessionCode, actorUserId, selectedToken.id);
      showToast("Move undone", "success");
    } catch (error) {
      console.error("Failed to undo move", error);
      showToast("Unable to undo move", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleLock = async () => {
    if (!sessionCode || !activeScene || !selectedToken || !isDM) return;
    setBusy(true);
    try {
      const nextToken: Omit<MapToken, "createdAt" | "updatedAt"> = {
        id: selectedToken.id,
        label: selectedToken.label,
        kind: selectedToken.kind,
        position: selectedToken.position,
        color: selectedToken.color,
        ownerUserId: selectedToken.ownerUserId,
        ownerCharacterId: selectedToken.ownerCharacterId,
        isLocked: !selectedToken.isLocked,
        movementMode: selectedToken.movementMode,
        speedFt: selectedToken.speedFt,
        remainingMovementFt: selectedToken.remainingMovementFt,
        speedModifiers: selectedToken.speedModifiers,
        lastMove: selectedToken.lastMove,
      };
      await GameService.upsertMapToken(sessionCode, activeScene.id, nextToken);
    } catch (error) {
      console.error("Failed to toggle lock", error);
      showToast("Failed to update lock", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateMarker = async () => {
    if (!sessionCode || !activeScene || !actorUserId || !allowMarkerCreation) return;
    const label = newMarkerLabel.trim();
    if (!label) {
      showToast("Marker label is required", "error");
      return;
    }

    setBusy(true);
    try {
      const tokenId = `custom_${crypto.randomUUID()}`;
      const token: Omit<MapToken, "createdAt" | "updatedAt"> = {
        id: tokenId,
        label,
        kind: "custom",
        position: { x: activeScene.imageWidth / 2, y: activeScene.imageHeight / 2 },
        color: newMarkerColor,
        ownerUserId: actorUserId,
        isLocked: false,
        movementMode: newMarkerMode,
        speedFt: newMarkerMode === "unlimited" ? undefined : Math.max(0, newMarkerSpeed),
        remainingMovementFt: newMarkerMode === "unlimited" ? undefined : Math.max(0, newMarkerSpeed),
        speedModifiers: [],
      };

      await GameService.upsertMapToken(sessionCode, activeScene.id, token);
      setSelectedTokenId(tokenId);
      showToast("Custom marker created", "success");
    } catch (error) {
      console.error("Failed to create marker", error);
      showToast("Failed to create marker", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!activeScene) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
        No active map scene yet. Ask your DM to upload and activate a map scene.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <div className="text-sm font-bold text-gray-900">{activeScene.name}</div>
            <div className="text-xs text-gray-500">
              {activeScene.imageWidth} x {activeScene.imageHeight} • Reveal {activeScene.revealRadiusFt} ft
            </div>
          </div>
          <div className={`text-xs font-bold px-2 py-1 rounded ${activeScene.freeRoamEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
            Free-Roam {activeScene.freeRoamEnabled ? "ON" : "OFF"}
          </div>
        </div>

        <div
          ref={viewportRef}
          className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50 touch-none"
          onPointerMove={handleViewportPointerMove}
          onPointerUp={handleViewportPointerUp}
          onPointerCancel={() => {
            setDraggingTokenId(null);
            setDragPoint(null);
          }}
        >
          <img
            src={activeScene.imageUrl}
            alt={activeScene.name}
            className="block w-full h-auto object-contain"
            draggable={false}
          />
          <div className="absolute inset-0">
            {tokens.map((token) => {
              const shownPoint = draggingTokenId === token.id && dragPoint ? dragPoint : token.position;
              const left = activeScene.imageWidth > 0 ? (shownPoint.x / activeScene.imageWidth) * 100 : 0;
              const top = activeScene.imageHeight > 0 ? (shownPoint.y / activeScene.imageHeight) * 100 : 0;
              const selected = selectedTokenId === token.id;

              return (
                <button
                  key={token.id}
                  type="button"
                  onClick={() => setSelectedTokenId(token.id)}
                  onPointerDown={(event) => handleTokenPointerDown(event, token)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 ${selected ? "border-black scale-125" : "border-white"}`}
                  style={{ left: `${left}%`, top: `${top}%`, backgroundColor: token.color || "#f97316" }}
                  title={token.label}
                />
              );
            })}
          </div>
        </div>
      </div>

      {selectedToken && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-gray-900">{selectedToken.label}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">{selectedToken.kind}</div>
            </div>
            <div className="text-xs font-bold text-gray-500">
              {selectedToken.remainingMovementFt !== undefined ? `${Math.round(selectedToken.remainingMovementFt)} ft left` : "Unlimited"}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleUndo}
              disabled={busy || !selectedToken.lastMove || !canEditToken(selectedToken)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-bold disabled:opacity-50 flex items-center gap-1"
            >
              <RotateCcw size={14} /> Undo
            </button>

            {isDM && (
              <button
                onClick={handleToggleLock}
                disabled={busy}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-bold flex items-center gap-1"
              >
                {selectedToken.isLocked ? <Lock size={14} /> : <LockOpen size={14} />}
                {selectedToken.isLocked ? "Unlock" : "Lock"}
              </button>
            )}
          </div>
        </div>
      )}

      {allowMarkerCreation && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Create Custom Marker</div>
          <input
            value={newMarkerLabel}
            onChange={(event) => setNewMarkerLabel(event.target.value)}
            placeholder="Marker label"
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={newMarkerMode}
              onChange={(event) => setNewMarkerMode(event.target.value as MapMovementMode)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="unlimited">Unlimited</option>
              <option value="fixed">Fixed speed</option>
              <option value="inherit">Inherit speed</option>
            </select>
            <input
              type="number"
              min={0}
              value={newMarkerSpeed}
              onChange={(event) => setNewMarkerSpeed(Math.max(0, Number(event.target.value) || 0))}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
              disabled={newMarkerMode === "unlimited"}
              placeholder="Speed (ft)"
            />
            <input
              type="color"
              value={newMarkerColor}
              onChange={(event) => setNewMarkerColor(event.target.value)}
              className="h-10 rounded-xl border border-gray-300"
            />
          </div>
          <button
            onClick={handleCreateMarker}
            disabled={busy}
            className="w-full rounded-xl bg-gray-900 text-white font-bold py-2.5 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Add Marker
          </button>
        </div>
      )}
    </div>
  );
}
