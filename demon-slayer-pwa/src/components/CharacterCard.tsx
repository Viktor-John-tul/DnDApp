import { Link } from "react-router-dom";
import type { RPGCharacter } from "../types";
import { Flame, User as UserIcon } from "lucide-react";

interface Props {
  character: RPGCharacter;
  onDelete: (id: string) => void;
}

export function CharacterCard({ character, onDelete }: Props) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4 relative group">
      <Link to={`/character/${character.id}`} className="flex-1 flex items-center gap-4">
        {character.photoUrl ? (
          <img 
            src={character.photoUrl} 
            alt={character.name} 
            className="w-16 h-16 rounded-xl object-cover bg-gray-200"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
            <UserIcon size={32} />
          </div>
        )}
        
        <div>
          <h3 className="font-bold text-gray-900">{character.name}</h3>
          <p className="text-sm text-gray-500">Lvl {character.level} {character.characterClass}</p>
          <div className="flex items-center gap-1 mt-1 text-slayer-orange">
            <Flame size={12} fill="currentColor" />
            <span className="text-xs font-bold uppercase">Demon Slayer</span>
          </div>
        </div>
      </Link>
      
      {/* Delete button (could be verify modal, simpler for now) */}
      <button 
        onClick={(e) => {
            e.preventDefault();
            if(confirm('Are you sure you want to delete this character?')) {
                character.id && onDelete(character.id);
            }
        }}
        className="text-red-400 hover:text-red-600 p-2 sm:opacity-0 group-hover:opacity-100 transition-opacity"
      >
        Delete
      </button>
    </div>
  );
}
