import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import { Bug, AlertCircle } from "lucide-react";

export function LoginPage() {
  const { signInWithGoogle, signInWithApple, debugLogin, user, error } = useAuth();

  if (user) return <Navigate to="/" />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-3 sm:p-4">
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl w-full max-w-md md:max-w-lg text-center">
        <h1 className="text-3xl font-bold mb-2 text-gray-800">Demon Slayer RPG</h1>
        <p className="text-gray-500 mb-8">Sign in to access your characters</p>
        
        {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 flex items-start gap-2">
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

          <div className="relative border-t border-gray-200 my-4">
             <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-white px-2 text-xs text-gray-400">DEV MODE</span>
          </div>

          <button 
            onClick={debugLogin}
            className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2"
          >
            <Bug size={18} />
            Guest / Dev Login
          </button>
        </div>
      </div>
    </div>
  );
}
