import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { DiceRoller } from "../services/rules";
import type { RollMode } from "../services/rules";

interface Props {
  mode: RollMode;
  modifier: number;
  label: string;
  onComplete: (total?: number) => void;
  diceCount?: number; // For non-d20 rolls
  diceFace?: number;
  extraDice?: { count: number, face: number }[]; // Support mixed dice types
}

const DiceIcon = ({ face, className }: { face: number, className: string }) => {
    let path = "";
    // Approximate 2D projections of dice shapes
    switch(face) {
        case 4: // Triangle
            path = "M50 10 L90 85 L10 85 Z"; 
            break;
        case 6: // Square (Cube)
            path = "M20 20 H80 V80 H20 Z"; 
            break;
        case 8: // Diamond (Octahedron)
            path = "M50 5 L95 50 L50 95 L5 50 Z"; 
            break;
        case 10: // Kite (Pentagonal Trapezohedron projection)
            path = "M50 5 L85 45 L50 95 L15 45 Z"; 
            break;
        case 12: // Pentagon (Dodecahedron)
            path = "M50 5 L93 38 L77 90 H23 L7 38 Z"; 
            break;
        case 20: // Hexagon (Icosahedron)
        default:
            path = "M50 0 L93 25 L93 75 L50 100 L7 75 L7 25 Z"; 
            break;
    }

    return (
        <svg viewBox="0 0 100 100" className={className}>
            <path d={path} fill="currentColor" />
        </svg>
    );
};

export function DiceRollerOverlay({ mode, modifier, label, onComplete, diceCount, diceFace, extraDice }: Props) {
  // Defaults
  let count = diceCount || 1;
  const face = diceFace || 20;

  // Build dice configuration array
  // If we have extraDice or diceCount, we treat it as a "Damage Roll" (sum of dice)
  // otherwise, default to d20 logic.
  let diceConfig: number[] = [];
  
  if (diceCount && diceFace) {
      // Base dice
      for(let i=0; i<diceCount; i++) diceConfig.push(diceFace);
      // Extra dice
      if (extraDice) {
          extraDice.forEach(d => {
              for(let i=0; i<d.count; i++) diceConfig.push(d.face);
          });
      }
  } else {
      // D20 Logic
      if (mode === 'advantage' || mode === 'disadvantage') {
          diceConfig = [20, 20];
      } else {
          diceConfig = [20];
      }
  }

  // Count comes from config length now for animation purposes
  count = diceConfig.length;

  const [currentValues, setCurrentValues] = useState<number[]>(Array(count).fill(1));
  const [finalResult, setFinalResult] = useState<{total: number, rolls: number[], isCrit: boolean, droppedRolls?: number[]} | null>(null);
  const [stage, setStage] = useState<'rolling' | 'result'>('rolling');

  useEffect(() => {
    // Start rolling animation
    const interval = setInterval(() => {
        // Update all dice with random values based on their specific face in diceConfig
        setCurrentValues(diceConfig.map(f => Math.floor(Math.random() * f) + 1));
    }, 60);

    // Determine result after 1s
    const timer = setTimeout(() => {
      clearInterval(interval);
      
      let total = 0;
      let rolls: number[] = [];
      let isCrit = false;


      // Logic split: Generic Multi-Dice vs Standard D20
      if (diceCount && diceFace) {
          // Manually roll individual dice based on config
          rolls = diceConfig.map(f => Math.floor(Math.random() * f) + 1);
          const sum = rolls.reduce((a, b) => a + b, 0);
          total = sum + modifier;
          isCrit = false;
      } else {
          // Standard D20 logic via service
          const result = DiceRoller.rollD20(mode);
          rolls = result.rolls || [result.die];
          total = result.die + modifier;
          isCrit = result.isCrit;
          
          // Identify dropped dice for visual effect
          if (mode === 'advantage') {
             // We used the max. The other is dropped.
             // Visual hack: we need to map the result rolls to the UI.
             // The service returns [r1, r2]. The 'die' is max(r1, r2).
             // We won't strictly know *which* index was dropped if they are equal, but that's fine.
          }
      }

      // Update state for result view
      setFinalResult({
        total,
        rolls,
        isCrit
      });
      setCurrentValues(rolls);
      setStage('result');
    }, 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [mode, modifier, count, face, diceCount, diceFace, JSON.stringify(extraDice)]); // Add extraDice dep

  // Helper to check if a die is "dropped" in adv/disadv
  const isDropped = (val: number) => {
      if (stage !== 'result' || !finalResult) return false;
      
      // If sum roll (damage), nothing dropped
      if (diceCount && diceFace) return false;

      // If normal d20, nothing dropped
      if (mode === 'normal') return false;

      const rawUsed = finalResult.total - modifier;
      
      // For Advantage/Disadvantage with same values
      if (finalResult.rolls[0] === finalResult.rolls[1]) {
          // Both are same, just dim the second one for visual effect? Or keep both?
          // Rules wise: you pick either. Visual wise: keep both active or just one.
          // Let's keep both active to show "double 20!" excitement.
          return false;
      }

      // Standard logic
      if (mode === 'advantage' && val < rawUsed) return true;
      if (mode === 'disadvantage' && val > rawUsed) return true;
      
      // If we are here, it matches the used value. 
      // Edge case: if we have [15, 15], both match used. Handled above.
      // If we have [15, 2] Disadv -> used 2. 15 > 2 -> dropped. 2 == 2 -> kept.
      return false;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" 
         onClick={stage === 'result' ? () => onComplete(finalResult?.total) : undefined}>
      <motion.div 
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center w-full max-w-lg px-4"
      >
        <h3 className="text-white text-xl font-bold mb-8 uppercase tracking-widest">{label}</h3>
        
        {/* Dice Container: Flex wrap for multiple dice */}
        <div className="flex flex-wrap justify-center items-center gap-4 mb-8">
            {currentValues.map((val, idx) => {
                const dropped = isDropped(val);
                // Use the face from config for correct icon
                const currentFace = diceConfig[idx] || 20;
                
                return (
                    <div key={idx} className={`relative inline-flex items-center justify-center w-32 h-32 transition-all duration-500 ${dropped ? 'opacity-20 blur-[1px] saturate-0 scale-90' : 'scale-105'}`}>
                        <DiceIcon 
                            face={currentFace} 
                            className="absolute inset-0 w-full h-full text-slayer-orange opacity-20 animate-spin-slow"
                        />
                        <span 
                            className={`relative text-4xl font-black ${
                                stage === 'result' 
                                ? (finalResult?.isCrit && !dropped ? 'text-green-400' : (stage === 'result' && val === 1 && face === 20 && !dropped ? 'text-red-500' : 'text-white'))
                                : 'text-white'
                            }`}
                        >
                            {val}
                        </span>
                        {dropped && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-full h-0.5 bg-red-500/50 rotate-45 transform scale-x-125" />
                                <div className="w-full h-0.5 bg-red-500/50 -rotate-45 transform scale-x-125" />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>

        {stage === 'result' && finalResult && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2"
          >
             <div className="flex flex-col items-center">
                 <p className="text-gray-400 text-sm uppercase tracking-wide mb-1">Total Result</p>
                 <div className="text-6xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                     {finalResult.total}
                 </div>
                 
                 {modifier !== 0 && (
                    <div className="mt-2 text-gray-500 text-sm">
                        {/* Fix Raw display to show USED die for D20, or SUM for damage */}
                        Raw ({
                            (diceCount && diceFace) 
                             ? finalResult.rolls.reduce((a,b)=>a+b,0) 
                             : (finalResult.total - modifier)
                        }) {modifier >= 0 ? '+' : '-'} {Math.abs(modifier)} (Mod)
                    </div>
                 )}
             </div>

             {finalResult.isCrit && <p className="text-green-400 font-bold mt-4 animate-pulse text-lg">CRITICAL SUCCESS!</p>}
             {!finalResult.isCrit && !diceCount && (finalResult.total - modifier === 1) && (
                  <p className="text-red-500 font-bold mt-4 animate-pulse text-lg">CRITICAL FAIL!</p>
             )}
             
            <p className="text-white/30 text-xs mt-12 animate-pulse">Tap anywhere to close</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
