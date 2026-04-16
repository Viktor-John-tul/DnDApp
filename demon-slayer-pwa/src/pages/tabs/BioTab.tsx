import { useState } from 'react';
import type { RPGCharacter } from '../../types';
import { Book, User, Save, FileText } from 'lucide-react';

interface Props {
  character: RPGCharacter;
  onUpdate: (updates: Partial<RPGCharacter>) => void;
  readOnly?: boolean;
}

export function BioTab({ character, onUpdate, readOnly }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(character);

  const handleSave = () => {
    onUpdate(formData);
    setIsEditing(false);
  };

  const handleChange = (field: keyof RPGCharacter, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
        <div className="space-y-5 sm:space-y-6 pb-24 md:pb-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <h3 className="text-lg font-bold text-gray-800">Character Details</h3>
        {!readOnly && (
        <button 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm ${isEditing ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'}`}
        >
            {isEditing ? <Save size={16}/> : <FileText size={16}/>}
            {isEditing ? 'Save Changes' : 'Edit Details'}
        </button>
        )}
      </div>

      <div className="space-y-4">
        <Section title="Appearance" icon={<User size={16} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Field label="Age" value={formData.age} onChange={v => handleChange('age', v)} editing={isEditing} />
                <Field label="Height" value={formData.height} onChange={v => handleChange('height', v)} editing={isEditing} />
                <Field label="Weight" value={formData.weight} onChange={v => handleChange('weight', v)} editing={isEditing} />
                <Field label="Eyes" value={formData.eyes} onChange={v => handleChange('eyes', v)} editing={isEditing} />
                <Field label="Skin" value={formData.skin} onChange={v => handleChange('skin', v)} editing={isEditing} />
                <Field label="Hair" value={formData.hair} onChange={v => handleChange('hair', v)} editing={isEditing} />
            </div>
        </Section>

        <Section title="Backstory" icon={<Book size={16} />}>
            <TextArea 
                value={formData.backstory} 
                onChange={v => handleChange('backstory', v)} 
                editing={isEditing} 
                placeholder="Write your character's history..."
            />
        </Section>

        <Section title="Notes" icon={<FileText size={16} />}>
            <TextArea 
                value={formData.notes} 
                onChange={v => handleChange('notes', v)} 
                editing={isEditing} 
                placeholder="Session notes, loot tracking, etc..."
            />
        </Section>

        {formData.dmNotes && (
            <div className="bg-purple-50 rounded-xl p-5 shadow-sm border border-purple-100">
                <h4 className="flex items-center gap-2 font-bold text-purple-800 mb-4 text-sm uppercase tracking-wide">
                    <FileText size={16} /> DM Notes
                </h4>
                <div className="text-sm font-medium text-purple-900 whitespace-pre-wrap leading-relaxed">
                    {formData.dmNotes}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h4 className="flex items-center gap-2 font-bold text-gray-700 mb-4 text-sm uppercase tracking-wide">
                {icon} {title}
            </h4>
            {children}
        </div>
    );
}

function Field({ label, value, onChange, editing }: { label: string; value: string; onChange: (v: string) => void; editing: boolean }) {
    return (
        <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{label}</label>
            {editing ? (
                <input 
                    className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-sm font-medium focus:ring-2 ring-black ring-opacity-10 outline-none transition-all"
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                />
            ) : (
                <div className="text-sm font-medium text-gray-800 border-b border-gray-100 pb-1">{value || '-'}</div>
            )}
        </div>
    );
}

function TextArea({ value, onChange, editing, placeholder }: { value: string; onChange: (v: string) => void; editing: boolean; placeholder?: string }) {
    if (editing) {
        return (
            <textarea 
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm min-h-[150px] focus:ring-2 ring-black ring-opacity-10 outline-none transition-all"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
            />
        );
    }
    return (
        <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
            {value || <span className="text-gray-300 italic">No content...</span>}
        </div>
    );
}
