import React, { useState } from 'react';
import { Lock, ShieldCheck, ChevronRight } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulating network delay for realism
    setTimeout(() => {
      // Hardcoded credentials check as requested
      if (email.trim() === 'atendimentomaxplayer@gmail.com' && password === 'Familialp0034') {
        onLoginSuccess();
      } else {
        setError('Credenciais inválidas. Acesso restrito à equipe MPLAY.');
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-black p-8 text-center border-b border-zinc-800 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold-500 to-transparent"></div>
           <div className="w-16 h-16 bg-zinc-900 rounded-2xl border border-zinc-700 flex items-center justify-center mx-auto mb-4 rotate-3 shadow-[0_0_30px_rgba(234,179,8,0.1)]">
              <ShieldCheck size={32} className="text-gold-500" />
           </div>
           <h2 className="text-2xl font-serif text-white mb-1">Acesso Administrativo</h2>
           <p className="text-zinc-500 text-xs tracking-widest uppercase">Sistema MPLAY Streaming</p>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Login Corporativo</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@mplay.com.br"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all placeholder-zinc-700"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Senha de Acesso</label>
              <div className="relative">
                <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all placeholder-zinc-700"
                />
                <Lock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-sm flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                 {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 text-black font-bold py-3.5 rounded-lg shadow-lg hover:shadow-gold-500/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                  <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></span>
              ) : (
                <>
                    ACESSAR PAINEL
                    <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
        
        <div className="px-8 pb-8 text-center">
            <p className="text-[10px] text-zinc-600">
                Acesso restrito. Todas as tentativas de login são monitoradas.
            </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
