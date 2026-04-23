import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Lock, LockOpen, RotateCcw, Plus, Ruler, CloudFog, Eraser, MapPin } from "lucide-react";
import { GameService } from "../services/gameService";
import type { GameSession } from "../services/gameService";
import type { MapFogStroke, MapMovementMode, MapPoint, MapToken } from "../types";
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
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibrationPointA, setCalibrationPointA] = useState<MapPoint | null>(null);
  const [calibrationPointB, setCalibrationPointB] = useState<MapPoint | null>(null);
  const [calibrationDistanceFt, setCalibrationDistanceFt] = useState(30);
  const [revealRadiusInput, setRevealRadiusInput] = useState(30);
  const [fogMode, setFogMode] = useState<"off" | "draw" | "erase">("off");
  const [fogBrushWidth, setFogBrushWidth] = useState(42);
  const [pendingFogPoints, setPendingFogPoints] = useState<MapPoint[]>([]);
  const [fogPreviewUserId, setFogPreviewUserId] = useState<string>("");
  const [spawnPlacementMode, setSpawnPlacementMode] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeScene = useMemo(() => {
    if (!mapState?.activeSceneId) return undefined;
    return mapState.scenes[mapState.activeSceneId];
  }, [mapState]);

  useEffect(() => {
    if (!activeScene) return;
    setRevealRadiusInput(activeScene.revealRadiusFt || 30);
    if (activeScene.calibration?.distanceFt) {
      setCalibrationDistanceFt(activeScene.calibration.distanceFt);
    }
  }, [activeScene?.id, activeScene?.revealRadiusFt, activeScene?.calibration?.distanceFt]);

  const tokens = useMemo(() => {
    if (!activeScene) return [] as MapToken[];
    return Object.values(activeScene.tokens || {});
  }, [activeScene]);

  const selectedToken = selectedTokenId
    ? tokens.find((token) => token.id === selectedTokenId)
    : undefined;

  const inCombat = !!session?.combat?.isActive;
  const pixelsPerFoot = activeScene?.calibration?.pixelsPerFoot && activeScene.calibration.pixelsPerFoot > 0
    ? activeScene.calibration.pixelsPerFoot
    : 10;
  const revealRadiusPx = (activeScene?.revealRadiusFt || 30) * pixelsPerFoot;
  const ownedTokens = tokens.filter((token) => token.ownerUserId === actorUserId);
  const sessionPlayers = Object.values(session?.players || {});
  const previewTokens = isDM
    ? (fogPreviewUserId ? tokens.filter((token) => token.ownerUserId === fogPreviewUserId) : [])
    : ownedTokens;

  const selectedTokenSpeedFt = selectedToken?.movementMode === "unlimited"
    ? undefined
    : Math.max(
        0,
        (selectedToken?.speedFt ?? 30)
          + (selectedToken?.speedModifiers || []).reduce((sum, entry) => sum + (entry.amountFt || 0), 0)
      );

  const selectedMovementBudgetFt = selectedToken?.remainingMovementFt ?? selectedTokenSpeedFt;
  const movementRadiusPx = selectedMovementBudgetFt && Number.isFinite(selectedMovementBudgetFt)
    ? selectedMovementBudgetFt * pixelsPerFoot
    : undefined;
  const sceneWidth = activeScene?.imageWidth ?? 0;
  const sceneHeight = activeScene?.imageHeight ?? 0;

  const circleLeftPct = selectedToken && sceneWidth > 0
    ? (selectedToken.position.x / sceneWidth) * 100
    : 0;
  const circleTopPct = selectedToken && sceneHeight > 0
    ? (selectedToken.position.y / sceneHeight) * 100
    : 0;
  const circleRadiusXPct = movementRadiusPx && sceneWidth > 0
    ? (movementRadiusPx / sceneWidth) * 100
    : 0;
  const circleRadiusYPct = movementRadiusPx && sceneHeight > 0
    ? (movementRadiusPx / sceneHeight) * 100
    : 0;

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
    event.stopPropagation();
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

  const handleViewportPointerDown = (event: ReactPointerEvent) => {
    if (isDM && spawnPlacementMode && selectedToken && sessionCode && activeScene) {
      const point = toScenePoint(event);
      if (!point) return;
      setBusy(true);
      void GameService.setMapSceneSpawnPoint(sessionCode, activeScene.id, selectedToken.id, point)
        .then(() => showToast("Spawn point saved", "success"))
        .catch((error) => {
          console.error("Failed to save spawn point", error);
          showToast("Failed to save spawn point", "error");
        })
        .finally(() => setBusy(false));
      return;
    }

    if (isDM && fogMode !== "off") {
      const point = toScenePoint(event);
      if (!point) return;
      setPendingFogPoints([point]);
      return;
    }

    if (!isDM || !calibrationMode) return;
    const point = toScenePoint(event);
    if (!point) return;

    if (!calibrationPointA) {
      setCalibrationPointA(point);
      setCalibrationPointB(null);
      return;
    }

    if (!calibrationPointB) {
      setCalibrationPointB(point);
      return;
    }

    setCalibrationPointA(point);
    setCalibrationPointB(null);
  };

  const handleFogPointerMove = (event: ReactPointerEvent) => {
    if (!isDM || fogMode === "off" || pendingFogPoints.length === 0) return;
    const point = toScenePoint(event);
    if (!point) return;
    setPendingFogPoints((previous) => [...previous, point]);
  };

  const handleFogPointerUp = async () => {
    if (!isDM || fogMode === "off" || !sessionCode || !activeScene) return;
    if (pendingFogPoints.length < 2) {
      setPendingFogPoints([]);
      return;
    }

    const stroke: MapFogStroke = {
      id: crypto.randomUUID(),
      mode: fogMode,
      width: fogBrushWidth,
      points: pendingFogPoints,
    };

    setPendingFogPoints([]);
    setBusy(true);
    try {
      await GameService.appendMapFogStroke(sessionCode, activeScene.id, stroke);
    } catch (error) {
      console.error("Failed to save fog stroke", error);
      showToast("Failed to update fog", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleClearFog = async () => {
    if (!isDM || !sessionCode || !activeScene) return;
    setBusy(true);
    try {
      await GameService.clearMapFogStrokes(sessionCode, activeScene.id);
      showToast("Fog cleared", "success");
    } catch (error) {
      console.error("Failed to clear fog", error);
      showToast("Failed to clear fog", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleUndoFogStroke = async () => {
    if (!isDM || !sessionCode || !activeScene) return;
    setBusy(true);
    try {
      await GameService.undoLastMapFogStroke(sessionCode, activeScene.id);
      showToast("Removed last fog stroke", "success");
    } catch (error) {
      console.error("Failed to undo fog stroke", error);
      showToast("Failed to undo fog stroke", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleSetAllSpawnsFromCurrentPositions = async () => {
    if (!isDM || !sessionCode || !activeScene) return;
    setBusy(true);
    try {
      await GameService.setAllSceneSpawnsFromCurrentTokens(sessionCode, activeScene.id);
      showToast("Spawn points set from current token positions", "success");
    } catch (error) {
      console.error("Failed to set all spawns", error);
      showToast("Failed to set all spawns", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleSetSpawnToTokenPosition = async () => {
    if (!sessionCode || !activeScene || !selectedToken) return;
    setBusy(true);
    try {
      await GameService.setMapSceneSpawnPoint(sessionCode, activeScene.id, selectedToken.id, selectedToken.position);
      showToast("Spawn set to token position", "success");
    } catch (error) {
      console.error("Failed to set spawn", error);
      showToast("Failed to set spawn", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleClearSpawn = async () => {
    if (!sessionCode || !activeScene || !selectedToken) return;
    setBusy(true);
    try {
      await GameService.clearMapSceneSpawnPoint(sessionCode, activeScene.id, selectedToken.id);
      showToast("Spawn cleared", "success");
    } catch (error) {
      console.error("Failed to clear spawn", error);
      showToast("Failed to clear spawn", "error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!activeScene || !fogCanvasRef.current) return;

    const canvas = fogCanvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.width = activeScene.imageWidth;
    canvas.height = activeScene.imageHeight;

    context.clearRect(0, 0, canvas.width, canvas.height);

    const strokes = [...(activeScene.fogStrokes || [])];
    if (pendingFogPoints.length > 1 && isDM && fogMode !== "off") {
      strokes.push({
        id: "pending",
        mode: fogMode,
        width: fogBrushWidth,
        points: pendingFogPoints,
      });
    }

    context.clearRect(0, 0, canvas.width, canvas.height);

    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      context.globalCompositeOperation = stroke.mode === "erase" ? "destination-out" : "source-over";
      context.strokeStyle = "rgba(0, 0, 0, 0.9)";
      context.lineWidth = stroke.width;
      context.lineJoin = "round";
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let index = 1; index < stroke.points.length; index += 1) {
        context.lineTo(stroke.points[index].x, stroke.points[index].y);
      }
      context.stroke();
    });

    if (previewTokens.length > 0) {
      context.globalCompositeOperation = "destination-out";
      previewTokens.forEach((token) => {
        context.beginPath();
        context.arc(token.position.x, token.position.y, revealRadiusPx, 0, Math.PI * 2);
        context.fill();
      });
    }

    context.globalCompositeOperation = "source-over";
  }, [activeScene, fogMode, fogBrushWidth, isDM, pendingFogPoints, previewTokens, revealRadiusPx]);

  const handleSaveCalibration = async () => {
    if (!sessionCode || !activeScene || !calibrationPointA || !calibrationPointB) return;
    if (calibrationDistanceFt <= 0) {
      showToast("Calibration distance must be greater than 0", "error");
      return;
    }

    const dx = calibrationPointB.x - calibrationPointA.x;
    const dy = calibrationPointB.y - calibrationPointA.y;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);
    if (pixelDistance <= 0) {
      showToast("Choose two different calibration points", "error");
      return;
    }

    setBusy(true);
    try {
      await GameService.setMapSceneCalibration(sessionCode, activeScene.id, {
        pointA: calibrationPointA,
        pointB: calibrationPointB,
        distanceFt: calibrationDistanceFt,
        pixelsPerFoot: pixelDistance / calibrationDistanceFt,
      });
      showToast("Map calibration saved", "success");
      setCalibrationMode(false);
      setCalibrationPointA(null);
      setCalibrationPointB(null);
    } catch (error) {
      console.error("Failed to save calibration", error);
      showToast("Failed to save calibration", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveRevealRadius = async () => {
    if (!sessionCode || !activeScene) return;
    setBusy(true);
    try {
      await GameService.setMapSceneRevealRadius(sessionCode, activeScene.id, revealRadiusInput);
      showToast("Reveal radius updated", "success");
    } catch (error) {
      console.error("Failed to set reveal radius", error);
      showToast("Failed to set reveal radius", "error");
    } finally {
      setBusy(false);
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

        {isDM && (
          <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCalibrationMode((prev) => !prev);
                  setCalibrationPointA(null);
                  setCalibrationPointB(null);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-bold border flex items-center gap-1 ${calibrationMode ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-white text-gray-700 border-gray-300"}`}
              >
                <Ruler size={14} /> Calibration {calibrationMode ? "ON" : "OFF"}
              </button>
              <input
                type="number"
                min={1}
                value={calibrationDistanceFt}
                onChange={(event) => setCalibrationDistanceFt(Math.max(1, Number(event.target.value) || 1))}
                className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="feet"
              />
              <button
                type="button"
                onClick={handleSaveCalibration}
                disabled={!calibrationPointA || !calibrationPointB || busy}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-bold disabled:opacity-50"
              >
                Save Scale
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Reveal Radius</span>
              <input
                type="number"
                min={1}
                value={revealRadiusInput}
                onChange={(event) => setRevealRadiusInput(Math.max(1, Number(event.target.value) || 1))}
                className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-gray-500">ft</span>
              <button
                type="button"
                onClick={handleSaveRevealRadius}
                disabled={busy}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-bold disabled:opacity-50"
              >
                Save Radius
              </button>
            </div>
            {calibrationMode && (
              <div className="text-xs text-amber-700 font-medium">
                Click point A, then point B on the map. Enter the real distance in feet and save.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFogMode((prev) => (prev === "draw" ? "off" : "draw"))}
                className={`px-3 py-2 rounded-lg text-sm font-bold border flex items-center gap-1 ${fogMode === "draw" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-gray-700 border-gray-300"}`}
              >
                <CloudFog size={14} /> Fog Draw
              </button>
              <button
                type="button"
                onClick={() => setFogMode((prev) => (prev === "erase" ? "off" : "erase"))}
                className={`px-3 py-2 rounded-lg text-sm font-bold border flex items-center gap-1 ${fogMode === "erase" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}
              >
                <Eraser size={14} /> Fog Erase
              </button>
              <input
                type="number"
                min={8}
                max={120}
                value={fogBrushWidth}
                onChange={(event) => setFogBrushWidth(clamp(Number(event.target.value) || 8, 8, 120))}
                className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={handleClearFog}
                disabled={busy}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-bold disabled:opacity-50"
              >
                Clear Fog
              </button>
              <button
                type="button"
                onClick={handleUndoFogStroke}
                disabled={busy || (activeScene.fogStrokes || []).length === 0}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-bold disabled:opacity-50"
              >
                Undo Fog
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Fog Preview</span>
              <select
                value={fogPreviewUserId}
                onChange={(event) => setFogPreviewUserId(event.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">DM Full View</option>
                {sessionPlayers.map((player) => (
                  <option key={player.id} value={player.userId}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div
          ref={viewportRef}
          className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50 touch-none"
          onPointerDown={handleViewportPointerDown}
          onPointerMove={(event) => {
            handleFogPointerMove(event);
            handleViewportPointerMove(event);
          }}
          onPointerUp={(event) => {
            void handleFogPointerUp();
            void handleViewportPointerUp(event);
          }}
          onPointerCancel={() => {
            setDraggingTokenId(null);
            setDragPoint(null);
            setPendingFogPoints([]);
          }}
        >
          <img
            src={activeScene.imageUrl}
            alt={activeScene.name}
            className="block w-full h-auto object-contain"
            draggable={false}
          />
          <div className="absolute inset-0">
            {inCombat && selectedToken && selectedToken.movementMode !== "unlimited" && movementRadiusPx && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sky-500/80 bg-sky-300/20"
                style={{
                  left: `${circleLeftPct}%`,
                  top: `${circleTopPct}%`,
                  width: `${circleRadiusXPct * 2}%`,
                  height: `${circleRadiusYPct * 2}%`,
                }}
              />
            )}

            {calibrationMode && calibrationPointA && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-amber-500 border border-white"
                style={{
                  left: `${(calibrationPointA.x / activeScene.imageWidth) * 100}%`,
                  top: `${(calibrationPointA.y / activeScene.imageHeight) * 100}%`,
                }}
              />
            )}

            {calibrationMode && calibrationPointB && (
              <>
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-amber-700 border border-white"
                  style={{
                    left: `${(calibrationPointB.x / activeScene.imageWidth) * 100}%`,
                    top: `${(calibrationPointB.y / activeScene.imageHeight) * 100}%`,
                  }}
                />
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <line
                    x1={`${(calibrationPointA!.x / activeScene.imageWidth) * 100}%`}
                    y1={`${(calibrationPointA!.y / activeScene.imageHeight) * 100}%`}
                    x2={`${(calibrationPointB.x / activeScene.imageWidth) * 100}%`}
                    y2={`${(calibrationPointB.y / activeScene.imageHeight) * 100}%`}
                    stroke="#d97706"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                  />
                </svg>
              </>
            )}

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

            {tokens.map((token) => {
              if (!token.lastMove) return null;
              const x1 = activeScene.imageWidth > 0 ? (token.lastMove.position.x / activeScene.imageWidth) * 100 : 0;
              const y1 = activeScene.imageHeight > 0 ? (token.lastMove.position.y / activeScene.imageHeight) * 100 : 0;
              const x2 = activeScene.imageWidth > 0 ? (token.position.x / activeScene.imageWidth) * 100 : 0;
              const y2 = activeScene.imageHeight > 0 ? (token.position.y / activeScene.imageHeight) * 100 : 0;

              return (
                <svg key={`path_${token.id}`} className="absolute inset-0 w-full h-full pointer-events-none">
                  <line
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    stroke={token.color || "#f97316"}
                    strokeWidth="2"
                    strokeDasharray="5 4"
                    opacity="0.85"
                  />
                </svg>
              );
            })}

            {Object.entries(activeScene.spawnByTokenId || {}).map(([tokenId, point]) => {
              if (sceneWidth <= 0 || sceneHeight <= 0) return null;
              const left = (point.x / sceneWidth) * 100;
              const top = (point.y / sceneHeight) * 100;
              return (
                <div
                  key={`spawn_${tokenId}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 text-emerald-600"
                  style={{ left: `${left}%`, top: `${top}%` }}
                  title={`Spawn: ${tokenId}`}
                >
                  <MapPin size={15} fill="currentColor" />
                </div>
              );
            })}

            <canvas
              ref={fogCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
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

          {inCombat && selectedToken.movementMode !== "unlimited" && (
            <div className="text-xs text-sky-700 font-medium">
              Combat movement radius shown in blue ring.
            </div>
          )}

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

            {isDM && (
              <button
                onClick={handleSetSpawnToTokenPosition}
                disabled={busy}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-bold flex items-center gap-1"
              >
                <MapPin size={14} /> Set Spawn Here
              </button>
            )}

            {isDM && (
              <button
                onClick={() => setSpawnPlacementMode((prev) => !prev)}
                disabled={busy}
                className={`px-3 py-2 rounded-lg border text-sm font-bold ${spawnPlacementMode ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "border-gray-300"}`}
              >
                {spawnPlacementMode ? "Spawn Click: ON" : "Spawn Click: OFF"}
              </button>
            )}

            {isDM && (
              <button
                onClick={handleClearSpawn}
                disabled={busy}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-bold"
              >
                Clear Spawn
              </button>
            )}

            {isDM && (
              <button
                onClick={handleSetAllSpawnsFromCurrentPositions}
                disabled={busy}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-bold"
              >
                Set All Spawns (Current)
              </button>
            )}
          </div>

          {isDM && spawnPlacementMode && (
            <div className="text-xs text-emerald-700 font-medium">
              Click on the map to place spawn for the selected token.
            </div>
          )}
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
