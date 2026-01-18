import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Camera, Shield, Zap, Heart, Wind, Swords } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { CharacterService } from "../services/characterService";
import { StorageService } from "../services/storageService";
import { StatStepper } from "../components/StatStepper";

import type { RPGCharacter } from "../types";

const ALL_SKILLS = [
  "Acrobatics (Dex)", "Animal Handling (Wis)", "Arcana (Int)", "Athletics (Str)",
  "Deception (Cha)", "History (Int)", "Insight (Wis)", "Intimidation (Cha)",
  "Investigation (Int)", "Medicine (Wis)", "Nature (Int)", "Perception (Wis)",
  "Performance (Cha)", "Persuasion (Cha)", "Religion (Int)", "Sleight of Hand (Dex)",
  "Stealth (Dex)", "Survival (Wis)"
];

export function DemonCreation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Identity
  const [name, setName] = useState("");
  const [rank, setRank] = useState("Demon");
  const [level, setLevel] = useState(1);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // Stats
  const [stats, setStats] = useState({
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
  });

  // Manual Vitals
  const [vitals, setVitals] = useState({
      ac: 10,
      hp: 10,
      speed: 30,
      init: 0,
      prof: 2
  });

  // Skills
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  
  // Demon Art
  const [bloodDemonArtName, setBloodDemonArtName] = useState("");
  
  // UI State
  const [isSaving, setIsSaving] = useState(false);

  // Handlers
  const handleStatChange = (stat: keyof typeof stats, value: number) => {
    // No points limit, just max 20 hard cap (optional, user said "max of one attribute is 20")
    if (value < 1) return;
    if (value > 20) return;
    setStats(prev => ({ ...prev, [stat]: value }));
  };

  const handleVitalChange = (vital: keyof typeof vitals, value: number) => {
      setVitals(prev => ({ ...prev, [vital]: value }));
  };

  const handleSkillToggle = (skill: string) => {
    // No limit on skills
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(prev => prev.filter(s => s !== skill));
    } else {
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

      const newCharacter: Omit<RPGCharacter, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: user.uid,
        name,
        type: 'demon',
        characterClass: rank,
        level,
        
        strength: stats.str,
        dexterity: stats.dex,
        constitution: stats.con,
        intelligence: stats.int,
        wisdom: stats.wis,
        charisma: stats.cha,

        // Custom Manual Vitals
        customAC: vitals.ac,
        customMaxHP: vitals.hp,
        customInitiative: vitals.init,
        customSpeed: vitals.speed,
        customProficiency: vitals.prof,
        
        // Populate standard fields compatible with display logic
        currentHP: vitals.hp,
        maxHP: vitals.hp, // Set max to manual value
        
        proficientSkills: selectedSkills,
        proficientSavingThrows: [], // Not specified
        
        photoUrl,
        
        breathingStyleName: "None", // Not used for Demons
        breathingForms: [], // Not used
        
        bloodDemonArtName: bloodDemonArtName,
        bloodDemonArts: [], // Added later in edit view

        kills: 0,
        
        // Defaults
        currentBreaths: 0,
        maxBreaths: 0, 
        currentOverdraftDC: 0,
        healingSurges: 0,
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
        
        // Fluff
        age: "", height: "", weight: "", eyes: "", skin: "", hair: "",
        personalityTraits: "", ideals: "", bonds: "", flaws: "",
        backstory: "", notes: ""
      };

      await CharacterService.create(newCharacter);
      navigate("/");
      
    } catch (error) {
      console.error(error);
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 p-4 pb-20">
      <header className="flex items-center gap-2 mb-6">
        <Link to="/" className="p-2 text-red-500 bg-gray-900 rounded-full">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-red-500">New Demon</h1>
      </header>
      
      <div className="space-y-6 max-w-lg mx-auto">
        
        {/* Identity Section */}
        <section className="bg-gray-900 p-4 rounded-xl shadow-lg border border-red-900/30">
          <div className="flex justify-center mb-6">
            <label className="relative block cursor-pointer group">
              <div className={`w-24 h-24 rounded-full border-4 border-red-900 overflow-hidden flex items-center justify-center bg-gray-950 ${!photoPreview && 'text-red-900'}`}>
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={32} />
                )}
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={handlePhotoSelect} />
            </label>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-red-700 uppercase mb-1">Demon Name</label>
              <input 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-gray-950 text-white p-3 rounded-lg border border-red-900 focus:outline-none focus:border-red-500"
                placeholder="Name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-red-700 uppercase mb-1">Rank / Title</label>
                    <input 
                        value={rank}
                        onChange={e => setRank(e.target.value)} // e.g. "Lower Moon 5"
                        className="w-full bg-gray-950 text-white p-3 rounded-lg border border-red-900 focus:outline-none focus:border-red-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-red-700 uppercase mb-1">Level (CR)</label>
                    <input 
                        type="number"
                        value={level}
                        onChange={e => setLevel(Number(e.target.value))}
                        className="w-full bg-gray-950 text-white p-3 rounded-lg border border-red-900 focus:outline-none focus:border-red-500"
                    />
                </div>
            </div>
            
             <div>
              <label className="block text-xs font-bold text-red-700 uppercase mb-1">Blood Demon Art Name</label>
              <input 
                value={bloodDemonArtName}
                onChange={e => setBloodDemonArtName(e.target.value)}
                className="w-full bg-gray-950 text-white p-3 rounded-lg border border-red-900 focus:outline-none focus:border-red-500"
                placeholder="e.g. Exploding Blood"
              />
            </div>
          </div>
        </section>

        {/* Manual Vitals */}
        <section className="bg-gray-900 p-4 rounded-xl shadow-lg border border-red-900/30">
            <h2 className="font-bold text-red-500 mb-4 flex items-center gap-2">
                <Heart size={18}/> Combat Stats
            </h2>
            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: 'Max HP', key: 'hp', icon: Heart },
                    { label: 'Armor Class', key: 'ac', icon: Shield },
                    { label: 'Speed (ft)', key: 'speed', icon: Wind },
                    { label: 'Initiative', key: 'init', icon: Zap },
                    { label: 'Proficiency', key: 'prof', icon: Swords },
                ].map((v) => (
                    <div key={v.key} className="bg-gray-950 p-2 rounded border border-gray-800">
                        <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">{v.label}</label>
                        <input 
                            type="number"
                            value={vitals[v.key as keyof typeof vitals]}
                            onChange={(e) => handleVitalChange(v.key as keyof typeof vitals, Number(e.target.value))}
                            className="w-full bg-transparent text-white font-mono font-bold text-lg focus:outline-none text-center"
                        />
                    </div>
                ))}
            </div>
        </section>

        {/* Stats Section */}
        <section className="bg-gray-900 p-4 rounded-xl shadow-lg border border-red-900/30">
          <div className="flex justify-between items-center mb-4">
             <h2 className="font-bold text-red-500">Attributes</h2>
             <span className="text-xs text-gray-500 uppercase">Max 20</span>
          </div>
          
          <div className="space-y-4">
            <StatStepper label="Strength" value={stats.str} onChange={v => handleStatChange('str', v)} max={20} color="red" />
            <StatStepper label="Dexterity" value={stats.dex} onChange={v => handleStatChange('dex', v)} max={20} color="red" />
            <StatStepper label="Constitution" value={stats.con} onChange={v => handleStatChange('con', v)} max={20} color="red" />
            <StatStepper label="Intelligence" value={stats.int} onChange={v => handleStatChange('int', v)} max={20} color="red"/>
            <StatStepper label="Wisdom" value={stats.wis} onChange={v => handleStatChange('wis', v)} max={20} color="red"/>
            <StatStepper label="Charisma" value={stats.cha} onChange={v => handleStatChange('cha', v)} max={20} color="red"/>
          </div>
        </section>

        {/* Skills Section */}
        <section className="bg-gray-900 p-4 rounded-xl shadow-lg border border-red-900/30">
          <div className="flex justify-between items-center mb-4">
               <h2 className="font-bold text-red-500">Skills</h2>
               <span className="text-xs text-gray-500 uppercase">{selectedSkills.length} Selected</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ALL_SKILLS.map(skill => (
              <button
                key={skill}
                onClick={() => handleSkillToggle(skill)}
                className={`p-2 rounded text-xs text-left font-medium transition-colors ${
                  selectedSkills.includes(skill)
                    ? 'bg-red-900/50 text-red-200 border border-red-700'
                    : 'bg-gray-950 text-gray-500 border border-transparent hover:bg-gray-800'
                }`}
              >
                {skill}
              </button>
            ))}
          </div>
        </section>

        <button
          onClick={handleSaveCharacter}
          disabled={!name || isSaving}
          className="w-full bg-red-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed sticky bottom-4"
        >
          {isSaving ? "Summoning..." : "Create Demon"}
        </button>
        
      </div>
    </div>
  );
}
