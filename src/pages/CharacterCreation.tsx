import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Camera, Shield, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { CharacterService } from "../services/characterService";
import { StorageService } from "../services/storageService";
import { StatStepper } from "../components/StatStepper";
import { useToast } from "../context/ToastContext";
import { getSlayerMaxBreaths } from "../services/slayerProgression";
import { BASE_ATTRIBUTE_VALUES, getCreationPointBudget } from "../services/levelProgression";

import type { RPGCharacter } from "../types";

const ALL_SKILLS = [
  "Acrobatics (Dex)", "Animal Handling (Wis)", "Arcana (Int)", "Athletics (Str)",
  "Deception (Cha)", "History (Int)", "Insight (Wis)", "Intimidation (Cha)",
  "Investigation (Int)", "Medicine (Wis)", "Nature (Int)", "Perception (Wis)",
  "Performance (Cha)", "Persuasion (Cha)", "Religion (Int)", "Sleight of Hand (Dex)",
  "Stealth (Dex)", "Survival (Wis)"
];



export function CharacterCreation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // Identity
  const [name, setName] = useState("");
  const [rank, setRank] = useState("");
  const [level, setLevel] = useState(1);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // Stats
  const [stats, setStats] = useState({
    str: BASE_ATTRIBUTE_VALUES.strength,
    dex: BASE_ATTRIBUTE_VALUES.dexterity,
    con: BASE_ATTRIBUTE_VALUES.constitution,
    int: BASE_ATTRIBUTE_VALUES.intelligence,
    wis: BASE_ATTRIBUTE_VALUES.wisdom,
    cha: BASE_ATTRIBUTE_VALUES.charisma
  });

  // Skills
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  
  // Demon Slayer
  const [breathingStyleName, setBreathingStyleName] = useState("");
  
  // UI State
  const [isSaving, setIsSaving] = useState(false);

  // Computed
  const pointsSpent = useMemo(() => {
      return (stats.str - BASE_ATTRIBUTE_VALUES.strength) +
        (stats.dex - BASE_ATTRIBUTE_VALUES.dexterity) +
        (stats.con - BASE_ATTRIBUTE_VALUES.constitution) +
        (stats.int - BASE_ATTRIBUTE_VALUES.intelligence) +
        (stats.wis - BASE_ATTRIBUTE_VALUES.wisdom) +
        (stats.cha - BASE_ATTRIBUTE_VALUES.charisma);
  }, [stats]);
  
    const pointsTotal = getCreationPointBudget(level, 'slayer');
  const pointsRemaining = pointsTotal - pointsSpent;

  // Handlers
  const handleStatChange = (stat: keyof typeof stats, value: number) => {
    const minValues = {
      str: BASE_ATTRIBUTE_VALUES.strength,
      dex: BASE_ATTRIBUTE_VALUES.dexterity,
      con: BASE_ATTRIBUTE_VALUES.constitution,
      int: BASE_ATTRIBUTE_VALUES.intelligence,
      wis: BASE_ATTRIBUTE_VALUES.wisdom,
      cha: BASE_ATTRIBUTE_VALUES.charisma,
    };
    if (value < minValues[stat]) return;
    const diff = value - stats[stat];
    if (diff > 0 && pointsRemaining < diff) return;
    setStats(prev => ({ ...prev, [stat]: value }));
  };

  const handleSkillToggle = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(prev => prev.filter(s => s !== skill));
    } else if (selectedSkills.length < 2) {
      setSelectedSkills(prev => [...prev, skill]);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveCharacter = async () => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      let photoUrl = null;
      if (photo) {
        photoUrl = await StorageService.uploadCharacterImage(user.uid, photo);
      }

      // Con Mod calculation for HP
      const conMod = Math.floor((stats.con - 10) / 2);
      const currentHP = (8 + conMod) * level;
      const maxBreaths = getSlayerMaxBreaths(level);

      const newCharacter: Omit<RPGCharacter, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: user.uid,
        name,
        type: 'slayer',
        characterClass: rank, // Mapped from "Class" or "Rank" UI
        level,
        
        strength: stats.str,
        dexterity: stats.dex,
        constitution: stats.con,
        intelligence: stats.int,
        wisdom: stats.wis,
        charisma: stats.cha,
        
        proficientSkills: selectedSkills,
        proficientSavingThrows: [], // Default empty for now
        photoUrl,
        
        breathingStyleName,
        breathingForms: [], // Empty initially
        
        currentBreaths: maxBreaths,
        maxBreaths,
        currentOverdraftDC: 15,

        
        currentHP,
        maxHP: currentHP, // Initial max HP equals current
        healingSurges: 3,
        
        deathSaveSuccesses: 0,
        deathSaveFailures: 0,
        
        gold: 0,
        inventory: [],
        customActions: [],
        
        activeBuff: {
          activeBuffFormID: null,
          activeBuffName: null,
          activeBuffDiceCount: null,
          activeBuffDiceFace: null,
          activeBuffRoundsRemaining: null
        },
        unspentLevelPoints: 0,
        
        age: "", height: "", weight: "", eyes: "", skin: "", hair: "",
        personalityTraits: "", ideals: "", bonds: "", flaws: "",
        backstory: "", notes: "",
        diceRollLogs: []
      };

      await CharacterService.create(newCharacter);
      navigate('/');
    } catch (error) {
      console.error("Save failed", error);
      showToast("Failed to save character. Please try again.", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = name.trim().length > 0 && pointsRemaining >= 0 && selectedSkills.length === 2;

  // Render Helpers
  const SkillButton = ({ skill }: { skill: string }) => {
    const isSelected = selectedSkills.includes(skill);
    const [skillName, attr] = skill.split(" (");
    
    return (
      <button 
        onClick={() => handleSkillToggle(skill)}
        className={`
          flex flex-col items-center justify-center py-3 rounded-lg border transition-all
          ${isSelected 
            ? 'border-slayer-orange bg-orange-50 text-slayer-orange' 
            : 'border-gray-200 hover:border-gray-300 text-gray-700'}
        `}
      >
        <span className={`text-sm ${isSelected ? 'font-bold' : 'font-medium'}`}>{skillName}</span>
        <span className={`text-xs ${isSelected ? 'text-orange-400' : 'text-gray-400'}`}>({attr}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
        
      {/* Header */}
      <header className="fixed top-0 inset-x-0 bg-white shadow-sm z-10 p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full">
              <ChevronLeft size={24} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">New Slayer</h1>
          </div>
          <button 
            onClick={handleSaveCharacter}
            disabled={!isFormValid || isSaving}
            className="text-slayer-orange font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>
      
      <main className="max-w-3xl mx-auto p-4 pt-20 space-y-8">
        
        {/* Identity */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Shield size={20} className="text-gray-400" /> Identity
          </h2>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <input 
              type="text" placeholder="Character Name" 
              value={name} onChange={e => setName(e.target.value)}
              className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-slayer-orange outline-none"
            />
            <div className="flex gap-4">
              <input 
                type="text" placeholder="Rank (e.g. Mizunoto)" 
                value={rank} onChange={e => setRank(e.target.value)}
                className="flex-1 p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-slayer-orange outline-none"
              />
              <div className="flex items-center gap-2 bg-gray-50 px-3 rounded-xl min-w-[120px]">
                <span className="text-gray-500 text-sm font-bold">Level</span>
                <input 
                  type="number" min="1" max="20"
                  value={level} onChange={e => setLevel(Math.max(1, Math.min(20, Number(e.target.value))))}
                  className="w-full bg-transparent font-bold text-center outline-none"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Zap size={20} className="text-gray-400" /> Stats
            </h2>
            <div className={`px-3 py-1 rounded-full text-sm font-bold ${pointsRemaining === 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-slayer-orange'}`}>
              Points: {pointsRemaining}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <StatStepper title="STR" value={stats.str} pointsRemaining={pointsRemaining} onChange={v => handleStatChange('str', v)} min={BASE_ATTRIBUTE_VALUES.strength} />
            <StatStepper title="DEX" value={stats.dex} pointsRemaining={pointsRemaining} onChange={v => handleStatChange('dex', v)} min={BASE_ATTRIBUTE_VALUES.dexterity} />
            <StatStepper title="CON" value={stats.con} pointsRemaining={pointsRemaining} onChange={v => handleStatChange('con', v)} min={BASE_ATTRIBUTE_VALUES.constitution} />
            <StatStepper title="INT" value={stats.int} pointsRemaining={pointsRemaining} onChange={v => handleStatChange('int', v)} min={BASE_ATTRIBUTE_VALUES.intelligence} />
            <StatStepper title="WIS" value={stats.wis} pointsRemaining={pointsRemaining} onChange={v => handleStatChange('wis', v)} min={BASE_ATTRIBUTE_VALUES.wisdom} />
            <StatStepper title="CHA" value={stats.cha} pointsRemaining={pointsRemaining} onChange={v => handleStatChange('cha', v)} min={BASE_ATTRIBUTE_VALUES.charisma} />
          </div>
        </section>

        {/* Skills */}
        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Skills</h2>
                <span className="text-sm text-gray-500">Pick {2 - selectedSkills.length} more</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
                {ALL_SKILLS.map(skill => (
                <SkillButton key={skill} skill={skill} />
                ))}
            </div>
        </section>

        {/* Photo */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Visuals</h2>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-2xl bg-gray-100 overflow-hidden relative">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <Camera size={48} />
                </div>
              )}
            </div>
            <label className="cursor-pointer bg-black text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-gray-800 transition">
              Select Photo
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
            </label>
          </div>
        </section>

        {/* Breathing */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slayer-orange flex items-center gap-2">
             Breathing Technique
          </h2>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
            <input 
                type="text" placeholder="Style Name (e.g. Flame Breathing)" 
                value={breathingStyleName} onChange={e => setBreathingStyleName(e.target.value)}
                className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-slayer-orange outline-none font-bold"
            />
             <p className="text-xs text-gray-400 mt-2 px-1">
                 You will create and manage your specific breathing forms in the Combat tab after creating your character.
             </p>
          </div>
        </section>

      </main>
    </div>
  );
}
