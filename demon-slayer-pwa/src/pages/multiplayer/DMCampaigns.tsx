import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, PlayCircle, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import { CampaignService } from "../../services/campaignService";
import { GameService } from "../../services/gameService";
import type { Campaign } from "../../types";

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

          {campaigns.map((campaign) => (
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
            </div>
          ))}
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
