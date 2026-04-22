import { useEffect, useMemo, useState } from "react";
import { X, ArrowUpCircle } from "lucide-react";
import type { RPGCharacter } from "../types";
import { Calculator } from "../services/rules";
import { BASE_ATTRIBUTE_VALUES, getLevelProgressionEntries } from "../services/levelProgression";
import { getSlayerMaxBreaths, isSlayerCharacter } from "../services/slayerProgression";
import { StatStepper } from "./StatStepper";

interface Props {
  character: RPGCharacter;
  mode: "preview" | "level-up";
  onClose: () => void;
  onApply?: (updates: Partial<RPGCharacter>) => void;
}

export function LevelProgressionModal({ character, mode, onClose, onApply }: Props) {
  const levelEntries = useMemo(() => getLevelProgressionEntries(character.type), [character.type]);
  const availablePoints = Math.max(0, character.unspentLevelPoints || 0);
  const isLevelUpMode = mode === "level-up";
  const isSlayer = isSlayerCharacter(character);

  const [draftStats, setDraftStats] = useState({
    strength: character.strength,
    dexterity: character.dexterity,
    constitution: character.constitution,
    intelligence: character.intelligence,
    wisdom: character.wisdom,
    charisma: character.charisma,
  });

  useEffect(() => {
    if (!isLevelUpMode) return;
    setDraftStats({
      strength: character.strength,
      dexterity: character.dexterity,
      constitution: character.constitution,
      intelligence: character.intelligence,
      wisdom: character.wisdom,
      charisma: character.charisma,
    });
  }, [character, isLevelUpMode]);

  const remainingPoints = availablePoints - (
    (draftStats.strength - character.strength) +
    (draftStats.dexterity - character.dexterity) +
    (draftStats.constitution - character.constitution) +
    (draftStats.intelligence - character.intelligence) +
    (draftStats.wisdom - character.wisdom) +
    (draftStats.charisma - character.charisma)
  );

  const getStatValue = (key: keyof typeof draftStats) => draftStats[key];
  const setStatValue = (key: keyof typeof draftStats, nextValue: number) => {
    setDraftStats((prev) => ({ ...prev, [key]: nextValue }));
  };

  const handleApply = () => {
    const spentPoints = Math.max(0, availablePoints - Math.max(0, remainingPoints));
    const maxHP = character.customMaxHP ?? Calculator.getMaxHP(draftStats.constitution, character.level);
    const nextBreaths = isSlayer ? getSlayerMaxBreaths(character.level) : character.maxBreaths;

    onApply?.({
      strength: draftStats.strength,
      dexterity: draftStats.dexterity,
      constitution: draftStats.constitution,
      intelligence: draftStats.intelligence,
      wisdom: draftStats.wisdom,
      charisma: draftStats.charisma,
      currentHP: maxHP,
      maxHP,
      currentBreaths: nextBreaths,
      maxBreaths: nextBreaths,
      unspentLevelPoints: Math.max(0, (character.unspentLevelPoints || 0) - spentPoints),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {isLevelUpMode ? `Level Up: Level ${character.level}` : "Level Progression"}
            </h3>
            <p className="text-sm text-gray-500">
              {isLevelUpMode
                ? `You have ${availablePoints} attribute point${availablePoints === 1 ? "" : "s"} to assign.`
                : "Review all level milestones before spending points."}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 grid gap-6 lg:grid-cols-[1.25fr_0.9fr]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500">Level Overview</h4>
              {isLevelUpMode && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slayer-orange/10 text-slayer-orange px-3 py-1 text-xs font-bold">
                  <ArrowUpCircle size={14} /> {availablePoints} points available
                </span>
              )}
            </div>

            <div className="max-h-[58vh] overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50">
              {levelEntries.map((entry) => {
                const isCurrent = entry.level === character.level;
                return (
                  <div
                    key={entry.level}
                    className={`border-b last:border-b-0 p-4 ${isCurrent ? "bg-slayer-orange/10" : "bg-transparent"}`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Level {entry.level}</div>
                        <h5 className="text-base font-bold text-gray-900">{entry.title}</h5>
                      </div>
                      {isCurrent && (
                        <span className="rounded-full bg-slayer-orange text-white px-3 py-1 text-[10px] font-black uppercase tracking-wider">
                          Current
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1 text-sm text-gray-600">
                      {entry.details.map((detail) => (
                        <li key={detail} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slayer-orange shrink-0" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {isLevelUpMode && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">Assign Attribute Points</h4>
                {availablePoints <= 0 ? (
                  <p className="text-sm text-gray-500">No points to assign for this level-up.</p>
                ) : (
                  <p className="text-sm text-gray-500">
                    Spend the points below, then confirm to save them.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatStepper title="STR" value={getStatValue("strength")} onChange={(value) => setStatValue("strength", value)} pointsRemaining={remainingPoints} min={Math.max(BASE_ATTRIBUTE_VALUES.strength, character.strength)} />
                <StatStepper title="DEX" value={getStatValue("dexterity")} onChange={(value) => setStatValue("dexterity", value)} pointsRemaining={remainingPoints} min={Math.max(BASE_ATTRIBUTE_VALUES.dexterity, character.dexterity)} />
                <StatStepper title="CON" value={getStatValue("constitution")} onChange={(value) => setStatValue("constitution", value)} pointsRemaining={remainingPoints} min={Math.max(BASE_ATTRIBUTE_VALUES.constitution, character.constitution)} />
                <StatStepper title="INT" value={getStatValue("intelligence")} onChange={(value) => setStatValue("intelligence", value)} pointsRemaining={remainingPoints} min={Math.max(BASE_ATTRIBUTE_VALUES.intelligence, character.intelligence)} />
                <StatStepper title="WIS" value={getStatValue("wisdom")} onChange={(value) => setStatValue("wisdom", value)} pointsRemaining={remainingPoints} min={Math.max(BASE_ATTRIBUTE_VALUES.wisdom, character.wisdom)} />
                <StatStepper title="CHA" value={getStatValue("charisma")} onChange={(value) => setStatValue("charisma", value)} pointsRemaining={remainingPoints} min={Math.max(BASE_ATTRIBUTE_VALUES.charisma, character.charisma)} />
              </div>

              <div className={`rounded-2xl p-4 border ${remainingPoints === 0 ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}`}>
                <div className="text-xs uppercase font-bold text-gray-400">Remaining Points</div>
                <div className="text-3xl font-black text-gray-900">{Math.max(0, remainingPoints)}</div>
              </div>

              <button
                onClick={handleApply}
                disabled={remainingPoints < 0}
                className="w-full rounded-2xl bg-slayer-orange text-white font-bold py-4 shadow-lg shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Progress
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold"
          >
            {isLevelUpMode ? "Later" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
