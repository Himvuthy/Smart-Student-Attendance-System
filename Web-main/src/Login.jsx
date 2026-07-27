import React, { useState, useEffect } from 'react';
import { User, Lock, Loader2, AlertCircle, Eye, EyeOff, Fingerprint, Sun, Moon, Info, Mail, Send } from 'lucide-react';

const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false); 
  const [isExiting, setIsExiting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminInfo, setShowAdminInfo] = useState(false);
  
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('appTheme') === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('appTheme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setShowAdminInfo(false);
    setIsLoading(true); 

    try {
      const response = await fetch('https://smart-student-attendance-system-nkka.onrender.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setIsLoading(false);
      setIsExiting(true); 
      setTimeout(() => {
        onLoginSuccess(String(data.user.roleid)); 
      }, 500); 

    } catch (err) {
      setIsLoading(false);
      setError(err.message);
    }
  };

  return (
    <div className={`min-h-screen w-full flex flex-col relative items-center justify-center font-sans overflow-hidden transition-opacity duration-500 ease-in-out ${isExiting ? 'opacity-0' : 'opacity-100'} bg-black`}>
      
      {/* Animated Background from old version */}
      <div className="absolute inset-0 z-0 bg-gradient-to-tr from-cyan-300 via-indigo-300 to-purple-400 animate-liquid pointer-events-none"></div>
      <div className={`absolute inset-0 z-0 bg-black transition-opacity duration-500 ease-in-out pointer-events-none ${isDark ? 'opacity-100' : 'opacity-0'}`}></div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes liquidMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-liquid {
          background-size: 300% 300% !important;
          animation: liquidMove 20s ease-in-out infinite !important;
        }
      `}} />

      {/* Logo from old version */}
      <div className={`absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-3 md:gap-4 z-[50]`}>
        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center backdrop-blur-xl border shadow-xl transition-all duration-500 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-white'}`}>
           <Fingerprint className={`w-6 h-6 md:w-7 md:h-7 transition-colors duration-500 ${isDark ? 'text-cyan-400' : 'text-indigo-600'}`} />
        </div>
        <h1 className={`${isDark ? 'text-white' : 'text-indigo-900'} font-black text-lg md:text-2xl tracking-tighter transition-colors duration-500 drop-shadow-sm`}>
          Smart Attendance
        </h1>
      </div>

      {/* Theme Toggle from old version */}
      <div className={`absolute bottom-6 right-6 md:bottom-8 md:right-8 z-[100]`}>
        <button 
          type="button"
          onClick={() => !isLoading && !isExiting && setIsDark((prev) => !prev)}
          className={`group flex items-center gap-2 md:gap-4 p-1.5 md:p-2 pr-4 md:pr-6 rounded-full backdrop-blur-2xl border transition-all duration-500 shadow-xl active:scale-90 ${isDark ? 'bg-white/10 border-white/10 text-white' : 'bg-white/80 border-white text-slate-900'} ${isLoading || isExiting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-500 ${isDark ? 'bg-black' : 'bg-indigo-600 shadow-inner'}`}>
            {isDark ? <Moon size={16} className="text-cyan-400" /> : <Sun size={16} className="text-yellow-300" />}
          </div>
          <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] select-none transition-colors duration-500">
            {isDark ? 'Dark' : 'Light'}
          </span>
        </button>
      </div>

      {/* The current untouched login window structure */}
      <div className={`bg-white/35 backdrop-blur-md rounded-[40px] border border-white shadow-2xl w-full max-w-[340px] px-8 py-10 relative flex flex-col justify-center z-10 transition-colors duration-500 ${isDark ? 'bg-black/40 border-white/10' : ''}`}>
        <h2 className={`text-[28px] font-black text-center mb-8 tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>Login</h2>
        
        {error && (
          <div className={`mb-6 p-3 border rounded-xl flex items-center gap-2 animate-in fade-in ${isDark ? 'bg-red-500/20 border-red-500/30' : 'bg-red-100 border-red-300'}`}>
            <AlertCircle size={14} className={`shrink-0 ${isDark ? 'text-red-200' : 'text-red-600'}`} />
            <p className={`text-[11px] font-bold leading-tight ${isDark ? 'text-red-100' : 'text-red-800'}`}>{error}</p>
          </div>
        )}

        {showAdminInfo && !error && (
          <div className={`mb-6 p-4 border rounded-xl flex flex-col gap-3 animate-in fade-in zoom-in duration-200 ${isDark ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-indigo-500/10 border-indigo-500/20'}`}>
            <div className="flex items-start gap-2">
              <Info size={14} className={`shrink-0 mt-0.5 ${isDark ? 'text-cyan-400' : 'text-indigo-600'}`} />
              <p className={`text-[10px] md:text-[11px] font-black leading-tight ${isDark ? 'text-cyan-100' : 'text-indigo-800'}`}>
                Please contact the administrator to resolve access issues:
              </p>
            </div>
            <div className="flex flex-col gap-2 pl-5">
              <a href="mailto:himvuthy09@gmail.com" className={`flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity text-[10px] md:text-[11px] font-bold ${isDark ? 'text-cyan-100' : 'text-indigo-800'}`}>
                <Mail size={12} /> himvuthy09@gmail.com
              </a>
              <a href="https://t.me/himvuthy09" target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity text-[10px] md:text-[11px] font-bold ${isDark ? 'text-cyan-100' : 'text-indigo-800'}`}>
                <Send size={12} /> @himvuthy09
              </a>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-wider block ${isDark ? 'text-white/40' : 'text-[#564e6b]'}`}>USERNAME OR EMAIL</label>
            <div className={`flex items-center pb-2 border-b-2 focus-within:border-[#9b7efa] transition-colors ${isDark ? 'border-white/10' : 'border-[#cbbbe6]'}`}>
              <User size={18} className={`shrink-0 ${isDark ? 'text-white/30' : 'text-[#564e6b]'}`} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Type your username or email"
                className={`flex-1 w-full bg-transparent border-none outline-none ml-4 text-[13px] font-bold placeholder:font-medium ${isDark ? 'text-white placeholder:text-white/20' : 'text-black placeholder:text-[#9e96b8]'}`}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-wider block ${isDark ? 'text-white/40' : 'text-[#564e6b]'}`}>PASSWORD</label>
            <div className={`flex items-center pb-2 border-b-2 focus-within:border-[#9b7efa] transition-colors relative ${isDark ? 'border-white/10' : 'border-[#cbbbe6]'}`}>
              <Lock size={18} className={`shrink-0 ${isDark ? 'text-white/30' : 'text-[#564e6b]'}`} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Type your password"
                className={`flex-1 w-full bg-transparent border-none outline-none ml-4 pr-8 text-[13px] font-bold placeholder:font-medium ${isDark ? 'text-white placeholder:text-white/20' : 'text-black placeholder:text-[#9e96b8]'}`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-0 bottom-2 transition-colors ${isDark ? 'text-white/30 hover:text-white' : 'text-[#564e6b] hover:text-[#9b7efa]'}`}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button type="button" onClick={() => { setError(''); setShowAdminInfo(true); }} className={`text-[10px] font-black transition-colors ${isDark ? 'text-white/40 hover:text-white' : 'text-[#564e6b] hover:text-[#9b7efa]'}`}>Forgot Password?</button>
          </div>

          <button 
            type="submit" 
            disabled={isLoading || isExiting}
            className={`w-full mt-4 py-4 rounded-full shadow-[0_8px_20px_-6px_rgba(136,84,255,0.6)] hover:shadow-[0_12px_25px_-6px_rgba(136,84,255,0.8)] text-white font-black hover:scale-[1.02] active:scale-95 transition-all duration-300 text-[11px] uppercase tracking-widest disabled:opacity-70 disabled:hover:scale-100 flex justify-center items-center ${isDark ? 'bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500' : 'bg-gradient-to-r from-[#8854ff] to-[#a34eff]'}`}
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin text-white" />
            ) : (
              "LOG IN"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
