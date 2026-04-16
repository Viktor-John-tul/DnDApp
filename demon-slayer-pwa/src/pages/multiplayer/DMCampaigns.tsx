import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, Copy, MapPin, PlayCircle, Plus, Skull, Target, Trash2, UserRound, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import { CampaignService } from "../../services/campaignService";
import { GameService } from "../../services/gameService";
import type { Campaign, CampaignPrepItem, CampaignPrepStatus, CampaignPrepType } from "../../types";

const PREP_TYPE_LABELS: Record<CampaignPrepType, string> = {
  npc: "NPC",
  demon: "Demon",
  location: "Location",
  objective: "Objective"
};

const PREP_TYPE_ICONS: Record<CampaignPrepType, typeof UserRound> = {
  npc: UserRound,
  demon: Skull,
  location: MapPin,
  objective: Target
};

const PREP_STATUS_LABELS: Record<CampaignPrepStatus, string> = {
  planned: "Planned",
  active: "Active",
  resolved: "Resolved"
};

const PREP_STATUS_STYLES: Record<CampaignPrepStatus, string> = {
  planned: "bg-gray-100 text-gray-600 border-gray-200",
  active: "bg-orange-100 text-orange-700 border-orange-200",
  resolved: "bg-emerald-100 text-emerald-700 border-emerald-200"
};

type PrepDraft = {
  type: CampaignPrepType;
  name: string;
  notes: string;
  threat: "" | "low" | "medium" | "high" | "boss";
};

const DEFAULT_PREP_DRAFT: PrepDraft = {
  type: "npc",
  name: "",
  notes: "",
  threat: ""
};

const nextPrepStatus = (status: CampaignPrepStatus): CampaignPrepStatus => {
  if (status === "planned") return "active";
  if (status === "active") return "resolved";
  return "planned";
};

export function DMCampaigns() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [expandedPrepCampaignId, setExpandedPrepCampaignId] = useState<string | null>(null);
  const [prepDrafts, setPrepDrafts] = useState<Record<string, PrepDraft>>({});

  const getPrepDraft = (campaignId: string): PrepDraft => prepDrafts[campaignId] || DEFAULT_PREP_DRAFT;

  useEffect(() => {
    if (!user) return;
    const unsubscribe = CampaignService.subscribeForDM(user.uid, (list) => {
      setCampaigns(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreate = async () => {
    if (!user) return;
    const name = nameInput.trim();
    if (!name) {
      showToast("Campaign name is required", "error");
      return;
    }

    setBusyId("create");
    try {
      await CampaignService.createCampaign(user.uid, name);
      setNameInput("");
      setShowCreate(false);
      showToast("Campaign created", "success");
    } catch (error) {
      console.error("Failed to create campaign", error);
      showToast("Failed to create campaign", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleStartSession = async (campaign: Campaign) => {
    if (!user) return;

    setBusyId(campaign.id);
    try {
      let sessionCode = campaign.activeSessionCode;
      if (!sessionCode) {
        sessionCode = await GameService.createGame(user.uid);
        await CampaignService.setActiveSessionCode(campaign.id, sessionCode);
      }
      navigate(`/dm/${campaign.id}`);
    } catch (error) {
      console.error("Failed to start session", error);
      showToast("Failed to start session", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (campaign: Campaign) => {
    const confirmed = await confirm({
      title: "Delete Campaign?",
      message: "This will remove the campaign for everyone and end any live session.",
      confirmText: "Delete",
      variant: "danger"
    });

    if (!confirmed) return;
    setBusyId(campaign.id);

    try {
      if (campaign.activeSessionCode) {
        await GameService.endSession(campaign.activeSessionCode);
      }
      await CampaignService.deleteCampaign(campaign.id);
      showToast("Campaign deleted", "info");
    } catch (error) {
      console.error("Failed to delete campaign", error);
      showToast("Failed to delete campaign", "error");
    } finally {
      setBusyId(null);
    }
  };

  const toggleMembers = (campaignId: string) => {
    setExpandedCampaignId((prev) => (prev === campaignId ? null : campaignId));
  };

  const togglePrep = (campaignId: string) => {
    setExpandedPrepCampaignId((prev) => (prev === campaignId ? null : campaignId));
  };

  const updateDraft = (campaignId: string, updates: Partial<PrepDraft>) => {
    setPrepDrafts((prev) => ({
      ...prev,
      [campaignId]: {
        ...getPrepDraft(campaignId),
        ...updates
      }
    }));
  };

  const resetDraft = (campaignId: string) => {
    setPrepDrafts((prev) => ({
      ...prev,
      [campaignId]: DEFAULT_PREP_DRAFT
    }));
  };

  const handleAddPrepItem = async (campaign: Campaign) => {
    const draft = getPrepDraft(campaign.id);
    const name = draft.name.trim();
    const notes = draft.notes.trim();

    if (!name) {
      showToast("Name is required", "error");
      return;
    }

    const newItem: CampaignPrepItem = {
      id: crypto.randomUUID(),
      type: draft.type,
      name,
      notes: notes || undefined,
      status: "planned",
      threat: draft.type === "demon" ? draft.threat || "medium" : null,
      createdAt: Date.now()
    };

    setBusyId(campaign.id);
    try {
      const prepItems = [...(campaign.prepItems || []), newItem];
      await CampaignService.updatePrepItems(campaign.id, prepItems);
      resetDraft(campaign.id);
      showToast(`${PREP_TYPE_LABELS[draft.type]} added to prep board`, "success");
    } catch (error) {
      console.error("Failed to add prep item", error);
      showToast("Failed to update prep board", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeletePrepItem = async (campaign: Campaign, itemId: string) => {
    setBusyId(campaign.id);
    try {
      const prepItems = (campaign.prepItems || []).filter((item) => item.id !== itemId);
      await CampaignService.updatePrepItems(campaign.id, prepItems);
      showToast("Prep item removed", "info");
    } catch (error) {
      console.error("Failed to remove prep item", error);
      showToast("Failed to remove prep item", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleCyclePrepStatus = async (campaign: Campaign, item: CampaignPrepItem) => {
    setBusyId(campaign.id);
    try {
      const prepItems = (campaign.prepItems || []).map((candidate) => {
        if (candidate.id !== item.id) return candidate;
        return {
          ...candidate,
          status: nextPrepStatus(candidate.status)
        };
      });
      await CampaignService.updatePrepItems(campaign.id, prepItems);
    } catch (error) {
      console.error("Failed to change prep status", error);
      showToast("Failed to update prep status", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 pb-24">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-gray-500 hover:text-gray-800">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">DM Campaigns</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-bold bg-white text-slayer-orange shadow-sm border border-gray-200 hover:bg-orange-50"
        >
          <Plus size={16} /> New
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-slayer-orange"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              No campaigns yet. Create one to start playing.
            </div>
          )}

          {campaigns.map((campaign) => {
            const members = Object.values(campaign.members || {}).sort((a, b) => a.name.localeCompare(b.name));
            const prepItems = [...(campaign.prepItems || [])].sort((a, b) => b.createdAt - a.createdAt);
            const isExpanded = expandedCampaignId === campaign.id;
            const isPrepExpanded = expandedPrepCampaignId === campaign.id;
            const prepByType: Record<CampaignPrepType, CampaignPrepItem[]> = {
              npc: prepItems.filter((item) => item.type === "npc"),
              demon: prepItems.filter((item) => item.type === "demon"),
              location: prepItems.filter((item) => item.type === "location"),
              objective: prepItems.filter((item) => item.type === "objective")
            };
            const draft = getPrepDraft(campaign.id);
            const membersButtonClasses = isExpanded
              ? "mt-4 w-full flex items-center justify-between px-3 py-2 rounded-xl border border-gray-900 text-sm font-bold text-white bg-gray-900"
              : "mt-4 w-full flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50";
            const prepButtonClasses = isPrepExpanded
              ? "mt-2 w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slayer-orange text-sm font-bold text-slayer-orange bg-orange-50"
              : "mt-2 w-full flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50";

            return (
            <div key={campaign.id} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{campaign.name}</h2>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Invite</span>
                    <span className="font-mono font-bold text-slayer-orange tracking-wider">{campaign.inviteCode}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(campaign.inviteCode);
                        showToast("Invite code copied", "success");
                      }}
                      className="text-gray-400 hover:text-gray-700"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                <div className="text-xs font-bold uppercase tracking-widest">
                  {campaign.activeSessionCode ? (
                    <span className="text-green-500">Live</span>
                  ) : (
                    <span className="text-gray-400">Idle</span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleStartSession(campaign)}
                  disabled={busyId === campaign.id}
                  className="flex-1 py-2.5 rounded-xl font-bold text-white bg-slayer-orange shadow-lg shadow-orange-200 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <PlayCircle size={16} /> {campaign.activeSessionCode ? "Open Session" : "Start Session"}
                </button>
                <button
                  onClick={() => handleDelete(campaign)}
                  disabled={busyId === campaign.id}
                  className="px-3 py-2.5 rounded-xl font-bold text-red-600 bg-red-50 border border-red-100 disabled:opacity-60"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <button
                onClick={() => toggleMembers(campaign.id)}
                className={membersButtonClasses}
              >
                <span className="flex items-center gap-2">
                  <Users size={16} /> Members ({members.length})
                </span>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              <button
                onClick={() => togglePrep(campaign.id)}
                className={prepButtonClasses}
              >
                <span className="flex items-center gap-2">
                  <Target size={16} /> Prep Board ({prepItems.length})
                </span>
                {isPrepExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {isExpanded && (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-inner">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Joined Players</div>
                    <div className="text-xs font-bold text-gray-500">{members.length} total</div>
                  </div>
                  {members.length === 0 ? (
                    <div className="text-sm text-gray-400">No players joined yet.</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {members.map((member) => {
                        const initial = member.name.trim().charAt(0).toUpperCase() || "?";

                        return (
                          <Link
                            key={member.id}
                            to={`/character/${member.id}`}
                            className="group aspect-square rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-orange-50 p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg"
                            aria-label={`Open ${member.name} sheet`}
                          >
                            <div className="flex h-full flex-col justify-between">
                              <div className="flex items-center justify-between">
                                <div className="h-10 w-10 rounded-xl bg-gray-900 text-white flex items-center justify-center text-lg font-black">
                                  {initial}
                                </div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-slayer-orange">
                                  Sheet
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-bold text-gray-800 line-clamp-2">
                                  {member.name}
                                </div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                  View
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {isPrepExpanded && (
                <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50/60 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    <select
                      value={draft.type}
                      onChange={(e) => {
                        const nextType = e.target.value as CampaignPrepType;
                        updateDraft(campaign.id, {
                          type: nextType,
                          threat: nextType === "demon" ? draft.threat || "medium" : ""
                        });
                      }}
                      className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                    >
                      <option value="npc">NPC</option>
                      <option value="demon">Demon</option>
                      <option value="location">Location</option>
                      <option value="objective">Objective</option>
                    </select>
                    {draft.type === "demon" ? (
                      <select
                        value={draft.threat || "medium"}
                        onChange={(e) => updateDraft(campaign.id, { threat: e.target.value as "low" | "medium" | "high" | "boss" })}
                        className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                      >
                        <option value="low">Threat: Low</option>
                        <option value="medium">Threat: Medium</option>
                        <option value="high">Threat: High</option>
                        <option value="boss">Threat: Boss</option>
                      </select>
                    ) : (
                      <div className="rounded-xl border border-dashed border-orange-200 bg-white/70 px-3 py-2 text-xs text-gray-400 flex items-center">
                        Threat level is available for demons.
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 mb-2">
                    <input
                      value={draft.name}
                      onChange={(e) => updateDraft(campaign.id, { name: e.target.value })}
                      placeholder={`Add ${PREP_TYPE_LABELS[draft.type]} name`}
                      className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                    <button
                      onClick={() => handleAddPrepItem(campaign)}
                      disabled={busyId === campaign.id}
                      className="px-4 py-2 rounded-xl bg-slayer-orange text-white text-sm font-bold disabled:opacity-60"
                    >
                      Add
                    </button>
                  </div>

                  <textarea
                    value={draft.notes}
                    onChange={(e) => updateDraft(campaign.id, { notes: e.target.value })}
                    placeholder="Notes (motivation, clue, encounter idea, loot, etc.)"
                    rows={2}
                    className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm text-gray-900"
                  />

                  <div className="mt-4 space-y-4">
                    {(["npc", "demon", "location", "objective"] as CampaignPrepType[]).map((type) => {
                      const items = prepByType[type];
                      const TypeIcon = PREP_TYPE_ICONS[type];

                      return (
                        <div key={type}>
                          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                            <TypeIcon size={14} /> {PREP_TYPE_LABELS[type]} ({items.length})
                          </div>
                          {items.length === 0 ? (
                            <div className="text-xs text-gray-400">No {PREP_TYPE_LABELS[type].toLowerCase()} yet.</div>
                          ) : (
                            <div className="space-y-2">
                              {items.map((item) => (
                                <div key={item.id} className="rounded-xl border border-orange-100 bg-white p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="text-sm font-bold text-gray-900">{item.name}</div>
                                      {item.notes && <div className="text-xs text-gray-500 mt-1">{item.notes}</div>}
                                      <div className="mt-2 flex items-center gap-2">
                                        <button
                                          onClick={() => handleCyclePrepStatus(campaign, item)}
                                          disabled={busyId === campaign.id}
                                          className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${PREP_STATUS_STYLES[item.status]}`}
                                        >
                                          {PREP_STATUS_LABELS[item.status]}
                                        </button>
                                        {item.threat && (
                                          <span className="px-2.5 py-1 rounded-full border border-red-100 bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-wider">
                                            {item.threat}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleDeletePrepItem(campaign, item.id)}
                                      disabled={busyId === campaign.id}
                                      className="text-red-400 hover:text-red-600 disabled:opacity-60"
                                      aria-label={`Remove ${item.name}`}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )})}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-lg mb-4">Create Campaign</h3>
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Campaign name"
              className="w-full p-3 border border-gray-300 rounded-xl mb-4 text-gray-900"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-3 font-bold text-gray-500 bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={busyId === "create"}
                className="flex-1 py-3 font-bold text-white bg-slayer-orange rounded-xl shadow-lg shadow-orange-200 disabled:opacity-60"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
