import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Plus, LogOut, Users } from "lucide-react";
import { CharacterService } from "../services/characterService";
import type { RPGCharacter } from "../types";
import { CharacterCard } from "../components/CharacterCard";

export function Dashboard() {
  const { user, logout } = useAuth();
  const [characters, setCharacters] = useState<RPGCharacter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadCharacters();
    }
  }, [user]);

  async function loadCharacters() {
    if (!user) return;
    try {
      const data = await CharacterService.getAll(user.uid);
      setCharacters(data);
    } catch (error) {
      console.error("Failed to load characters", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await CharacterService.delete(id);
      setCharacters(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error("Failed to delete", error);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 pb-20">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Slayer Corps</h1>
        <div className="flex gap-2">
           <Link to="/dm" className="p-2 text-slayer-orange bg-white rounded-full shadow-sm hover:bg-orange-50 font-bold text-xs flex items-center gap-1">
              <Users size={16} /> DM
           </Link>
           <button 
            onClick={logout} 
            className="p-2 text-gray-500 hover:text-gray-700 bg-white rounded-full shadow-sm"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-slayer-orange"></div>
        </div>
      ) : (
        <div className="space-y-4">
            {characters.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                    No characters found. Start your journey!
                </div>
            )}
            {characters.map(char => (
                <CharacterCard key={char.id} character={char} onDelete={handleDelete} />
            ))}
            
            <Link 
            to="/create"
            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-center gap-2 text-slayer-orange font-bold hover:bg-orange-50 transition"
            >
            <Plus size={24} />
            Create Demon Slayer
            </Link>
        </div>
      )}
    </div>
  );
}
