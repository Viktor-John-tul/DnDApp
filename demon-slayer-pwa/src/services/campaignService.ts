import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import { db } from "./firebase";
import type { Campaign, CampaignMember, RPGCharacter } from "../types";

const COLLECTION = "campaigns";

export const CampaignService = {
  generateInviteCode: () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  },

  createCampaign: async (dmId: string, name: string): Promise<Campaign> => {
    const inviteCode = CampaignService.generateInviteCode();
    const createdAt = Date.now();
    const docRef = await addDoc(collection(db, COLLECTION), {
      dmId,
      name,
      inviteCode,
      createdAt,
      activeSessionCode: "",
      members: {}
    });

    return {
      id: docRef.id,
      dmId,
      name,
      inviteCode,
      createdAt,
      activeSessionCode: "",
      members: {}
    };
  },

  subscribeForDM: (dmId: string, callback: (campaigns: Campaign[]) => void) => {
    const q = query(collection(db, COLLECTION), where("dmId", "==", dmId));
    return onSnapshot(q, (snapshot) => {
      const campaigns = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Campaign, "id">)
      })) as Campaign[];

      campaigns.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(campaigns);
    });
  },

  subscribeToCampaign: (campaignId: string, callback: (campaign: Campaign | null) => void) => {
    return onSnapshot(doc(db, COLLECTION, campaignId), (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      callback({ id: snapshot.id, ...(snapshot.data() as Omit<Campaign, "id">) } as Campaign);
    });
  },

  getCampaign: async (campaignId: string): Promise<Campaign | null> => {
    const snap = await getDoc(doc(db, COLLECTION, campaignId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Campaign, "id">) } as Campaign;
  },

  getByInviteCode: async (inviteCode: string): Promise<Campaign | null> => {
    const normalized = inviteCode.trim().toUpperCase();
    const q = query(collection(db, COLLECTION), where("inviteCode", "==", normalized));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...(docSnap.data() as Omit<Campaign, "id">) } as Campaign;
  },

  addMember: async (campaignId: string, character: RPGCharacter) => {
    const memberId = character.id;
    if (!memberId) return;

    const member: CampaignMember = {
      id: memberId,
      name: character.name,
      userId: character.userId,
      joinedAt: Date.now()
    };

    await updateDoc(doc(db, COLLECTION, campaignId), {
      [`members.${memberId}`]: member
    });
  },

  setActiveSessionCode: async (campaignId: string, sessionCode: string) => {
    await updateDoc(doc(db, COLLECTION, campaignId), {
      activeSessionCode: sessionCode
    });
  },

  deleteCampaign: async (campaignId: string) => {
    await deleteDoc(doc(db, COLLECTION, campaignId));
  }
};
