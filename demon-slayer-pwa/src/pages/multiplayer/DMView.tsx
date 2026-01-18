import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { GameService } from "../../services/gameService";
import type { GameSession } from "../../services/gameService";
import { Copy, Users, Heart, Wind, Power, ArrowLeft } from 'lucide-react';

export function DMView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize Game Session
  useEffect(() => {
    const initGame = async () => {
      if (!user) return;
      try {
        // Try to resume an existing session first
        const existingCode = await GameService.resumeSession(user.uid);
        if (existingCode) {
            setSessionCode(existingCode);
        } else {
            // Only create if none exists
            const code = await GameService.createGame(user.uid);
            setSessionCode(code);
        }
      } catch (err) {
        console.error("Failed to create/resume game", err);
      }
    };
    initGame();
  }, [user]);

  // Subscribe to Session
  useEffect(() => {
    if (!sessionCode) return;
    
    const unsubscribe = GameService.subscribeToSession(sessionCode, (data) => {
      if (!data) {
          // Session was deleted remotely
          setSessionCode(null);
          setSession(null);
          navigate("/"); // Go back to dashboard if session ends
          return;
      }
      setSession(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [sessionCode, navigate]);

  const handleEndSession = async () => {
      if (!sessionCode || !confirm("Are you sure you want to end this session? All players will be disconnected.")) return;
      
      try {
          await GameService.endSession(sessionCode);
          setSessionCode(null);
          navigate("/");
      } catch (err) {
          console.error(err);
      }
  };

  if (loading || !sessionCode) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-slayer-orange border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500 font-bold">Accessing Session...</p>
        </div>
      </div>
    );
  }

  const players = Object.values(session?.players || {});

  return (
    <div className="min-h-screen bg-gray-100 p-4 pb-24">
       {/* Header / HUD */}
       <div className="bg-gray-900 text-white p-4 rounded-xl shadow-lg mb-6 sticky top-2 z-10">
          <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <Link to="/" className="text-gray-400 hover:text-white"><ArrowLeft size={20}/></Link>
                <h1 className="font-bold text-lg">DM Overwatch</h1>
              </div>
              
              <button 
                onClick={handleEndSession}
                className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs font-bold border border-red-900 bg-red-900/20 px-2 py-1 rounded"
              >
                  <Power size={12} /> END
              </button>
          </div>

          <div className="flex justify-between items-end">
            <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
                  <span className="text-xs text-gray-400 uppercase tracking-widest">Join Code</span>
                  <span className="font-mono font-bold text-slayer-orange text-lg tracking-wider">{sessionCode}</span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(sessionCode)}
                    className="ml-2 text-gray-500 hover:text-white"
                  >
                      <Copy size={14} />
                  </button>
            </div>
            <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Users size={16} />
                <span>{players.length} Players</span>
            </div>
          </div>
       </div>

       {/* Players Grid */}
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {players.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-400">
                  <p>Waiting for slayers to join...</p>
              </div>
          ) : (
             players.map(player => (
                 <div key={player.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                     {/* Player Header */}
                     <div className="bg-gray-50 p-3 border-b border-gray-100 flex justify-between items-center">
                         <h3 className="font-bold text-gray-800">{player.name}</h3>
                         <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded">Lvl {player.level}</span>
                     </div>

                     {/* Stats */}
                     <div className="p-4 space-y-4">
                         {/* HP */}
                         <div>
                             <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                                 <span className="flex items-center gap-1"><Heart size={12} className="text-red-500"/> HP</span>
                                 <span>{player.currentHP} / {player.maxHP}</span>
                             </div>
                             <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                 <div 
                                    className="h-full bg-red-500 transition-all duration-500"
                                    style={{ width: `${(player.currentHP / player.maxHP) * 100}%` }}
                                 />
                             </div>
                         </div>

                         {/* SP/Breath */}
                         <div>
                             <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                                 <span className="flex items-center gap-1"><Wind size={12} className="text-cyan-500"/> Breath</span>
                                 <span>{player.currentBreaths} / {player.maxBreaths}</span>
                             </div>
                             <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                 <div 
                                    className={`h-full transition-all duration-500 ${player.currentBreaths < 0 ? 'bg-red-600' : 'bg-cyan-500'}`}
                                    style={{ width: `${Math.min(100, Math.max(0, (player.currentBreaths / player.maxBreaths) * 100))}%` }}
                                 />
                             </div>
                         </div>
                     </div>
                 </div>
             ))
          )}
       </div>
    </div>
  );
}
