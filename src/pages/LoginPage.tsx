import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import { Bug, AlertCircle } from "lucide-react";

export function LoginPage() {
  const { signInWithGoogle, signInWithApple, debugLogin, user, error } = useAuth();

  if (user) return <Navigate to="/" />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-950 p-4 transition-colors">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-transparent dark:border-slate-700">
        <h1 className="text-3xl font-bold mb-2 text-gray-800 dark:text-gray-100">Demon Slayer RPG</h1>
        <p className="text-gray-500 dark:text-slate-400 mb-8">Sign in to access your characters</p>
        
        {error && (
            <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 p-3 rounded-lg text-sm mb-6 flex items-start gap-2 border border-transparent dark:border-red-900/40">
                <AlertCircle className="shrink-0 mt-0.5" size={16} />
                <span className="text-left font-medium">{error}</span>
            </div>
        )}

        <div className="space-y-4">
          <button 
            onClick={signInWithGoogle}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2"
          >
            Sign in with Google
          </button>
          
          <button 
            onClick={signInWithApple}
            className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2"
          >
            Sign in with Apple
          </button>

          <div className="relative border-t border-gray-200 dark:border-slate-700 my-4">
             <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-white dark:bg-slate-900 px-2 text-xs text-gray-400 dark:text-slate-500">DEV MODE</span>
          </div>

          <button 
            onClick={debugLogin}
            className="w-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 font-bold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 border border-transparent dark:border-blue-900/40"
          >
            <Bug size={18} />
            Guest / Dev Login
          </button>
        </div>
      </div>
    </div>
  );
}
