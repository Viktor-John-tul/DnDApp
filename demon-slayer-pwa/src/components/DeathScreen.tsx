import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Skull, Activity } from 'lucide-react';
import type { RPGCharacter } from '../types';
import { DiceRollerOverlay } from './DiceRollerOverlay';

interface Props {
  character: RPGCharacter;
  onUpdate: (updates: Partial<RPGCharacter>) => void;
}

export function DeathScreen({ character, onUpdate }: Props) {
  const [rolling, setRolling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const successes = character.deathSaveSuccesses || 0;
  const failures = character.deathSaveFailures || 0;

  const isDead = failures >= 3;
  const isStable = successes >= 3;

  const handleRollComplete = (total?: number) => {
    if (total === undefined) return;
    
    setRolling(false);
    const updates: Partial<RPGCharacter> = {};
    let msg = "";

    const currentFailures = character.deathSaveFailures || 0;
    const currentSuccesses = character.deathSaveSuccesses || 0;

    if (total === 20) {
      // Regain 1 HP immediately
      updates.currentHP = 1;
      updates.deathSaveFailures = 0;
      updates.deathSaveSuccesses = 0;
      msg = "CRITICAL SUCCESS! You regain consciousness!";
    } else if (total === 1) {
      // 2 Failures
      updates.deathSaveFailures = Math.min(3, currentFailures + 2);
      msg = "CRITICAL FAILURE! Two death save failures!";
    } else if (total >= 10) {
      // Success
      updates.deathSaveSuccesses = Math.min(3, currentSuccesses + 1);
      msg = "Success! You cling to life.";
    } else {
      // Failure
      updates.deathSaveFailures = Math.min(3, currentFailures + 1);
      msg = "Failure! Your life fades...";
    }

    setMessage(msg);
    onUpdate(updates);
  };



  const handleRevive = () => {
     onUpdate({ currentHP: 1, deathSaveFailures: 0, deathSaveSuccesses: 0 });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 text-white overflow-y-auto"
    >
      <div className="max-w-md w-full space-y-8 text-center">
        
        {/* Header */}
        <div className="space-y-4">
            <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="inline-block"
            >
                <Skull size={80} className="text-red-600 mx-auto drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
            </motion.div>
            <h1 className="text-5xl font-serif font-bold tracking-widest text-red-500">DEATH SAVES</h1>
            <p className="text-xl text-gray-400 font-serif">{character.name} is unconscious</p>
        </div>

        {/* Trackers */}
        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm grid grid-cols-2 gap-8">
            <div className="space-y-3">
                <h3 className="text-gray-400 font-bold text-sm tracking-wider">SUCCESSES</h3>
                <div className="flex justify-center gap-2">
                    {[1, 2, 3].map(i => (
                        <Heart 
                            key={i} 
                            size={24} 
                            // weight="fill" removed
                            className={i <= successes ? "fill-green-500 text-green-500" : "text-gray-700"}
                        />
                    ))}
                </div>
            </div>
            <div className="space-y-3">
                <h3 className="text-gray-400 font-bold text-sm tracking-wider">FAILURES</h3>
                <div className="flex justify-center gap-2">
                    {[1, 2, 3].map(i => (
                        <Heart 
                            key={i} 
                            size={24}
                            className={i <= failures ? "fill-red-600 text-red-600" : "text-gray-700"}
                        />
                    ))}
                </div>
            </div>
        </div>

        {/* Status Messages */}
        <AnimatePresence>
            {message && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-white/10 rounded-xl text-lg font-bold text-yellow-100"
                >
                    {message}
                </motion.div>
            )}
        </AnimatePresence>

        {/* Controls */}
        <div className="space-y-4 pt-8">
            {!isDead && !isStable && (
                <button
                    onClick={() => setRolling(true)}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-full shadow-lg shadow-red-900/50 flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                    <Activity size={24} />
                    ROLL DEATH SAVE
                </button>
            )}

            {isDead && (
                <div className="space-y-4">
                    <p className="text-2xl font-black text-gray-500 uppercase">Character Deceased</p>
                    <button 
                        onClick={handleRevive}
                        className="text-sm text-gray-500 underline hover:text-white"
                    >
                        GM Override: Revive to 1 HP
                    </button>
                </div>
            )}

            {isStable && (
                <div className="space-y-4">
                     <p className="text-2xl font-bold text-green-400">STABILIZED</p>
                     <p className="text-gray-400 text-sm">You are stable but unconscious.</p>
                     <button 
                        onClick={handleRevive}
                        className="bg-green-600 text-white py-3 px-6 rounded-xl font-bold active:scale-95 transition-all"
                    >
                        Receive Healing (1 HP)
                    </button>
                </div>
            )}
             
            {/* Admin/Debug escape hatch */}
             <button 
                onClick={() => onUpdate({ currentHP: 1 })}
                className="mt-8 text-xs text-gray-700 hover:text-gray-500"
            >
                Force Revive (Debug)
            </button>
        </div>
      </div>

      {rolling && (
        <DiceRollerOverlay
            mode="normal"
            modifier={0}
            label="Death Saving Throw"
            onComplete={handleRollComplete}
        />
      )}
    </motion.div>
  );
}
