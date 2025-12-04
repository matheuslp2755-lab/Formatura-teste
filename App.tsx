import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import ViewerPanel from './components/ViewerPanel';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';
import { StreamStatus } from './types';
import { Video, LogOut } from 'lucide-react';
import { subscribeToStreamStatus, updateStreamStatus } from './services/firebase';

// Componente Wrapper para proteger a rota Admin
const ProtectedAdminRoute = ({ 
  isAuthenticated, 
  onLogin, 
  children 
}: { 
  isAuthenticated: boolean; 
  onLogin: () => void;
  children?: React.ReactNode 
}) => {
  if (!isAuthenticated) {
    return <Login onLoginSuccess={onLogin} />;
  }
  return <>{children}</>;
};

function AppContent() {
  const [status, setStatus] = useState<StreamStatus>(StreamStatus.OFFLINE);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  // Escutar mudanças no Firebase (Global para todo o app)
  useEffect(() => {
    // Inscreve para receber atualizações do Firebase em tempo real
    const unsubscribe = subscribeToStreamStatus((newStatus) => {
      console.log("App: Recebido novo status:", newStatus);
      setStatus(newStatus);
    });

    return () => unsubscribe();
  }, []);

  const handleAdminUpdate = (newStatus: StreamStatus) => {
    console.log("App: Admin alterou status para:", newStatus);
    
    // 1. Atualiza visualmente para o Admin IMEDIATAMENTE (Feedback Instantâneo)
    setStatus(newStatus);
    
    // 2. Envia para o Firebase/LocalStorage em segundo plano para os outros usuários
    updateStreamStatus(newStatus);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col font-sans selection:bg-gold-500/30">
        
        {/* Navigation / Header */}
        <nav className="border-b border-zinc-900 bg-black/50 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-8 h-8 bg-gold-600 rounded flex items-center justify-center shadow-lg shadow-gold-500/10">
                <Video className="text-black" size={18} />
              </div>
              <div className="flex flex-col">
                <span className="font-serif font-bold text-white leading-none tracking-wide group-hover:text-gold-400 transition-colors">MPLAY</span>
                <span className="text-[10px] text-zinc-500 tracking-[0.2em] uppercase">Transmissão realizada pela Mplay</span>
              </div>
            </Link>

            <div className="flex items-center gap-6">
              {isAuthenticated ? (
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-xs text-zinc-500 hover:text-red-400 transition-colors uppercase font-bold tracking-wider"
                  >
                    <LogOut size={14} />
                    Sair
                  </button>
              ) : (
                  <Link to="/admin" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors font-medium">
                    Área Admin
                  </Link>
              )}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 flex flex-col">
          <Routes>
            <Route path="/" element={<ViewerPanel status={status} />} />
            
            <Route path="/admin" element={
              <ProtectedAdminRoute 
                isAuthenticated={isAuthenticated} 
                onLogin={() => setIsAuthenticated(true)}
              >
                  <div className="max-w-4xl mx-auto w-full animate-in fade-in duration-500">
                      <AdminPanel 
                        currentStatus={status} 
                        onUpdate={handleAdminUpdate} 
                      />
                  </div>
              </ProtectedAdminRoute>
            } />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-zinc-900 bg-black py-8 mt-auto">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <h4 className="text-gold-500 font-serif tracking-widest text-lg mb-2">FORMATURA EASP 2025</h4>
            <p className="text-zinc-600 text-sm">
              Transmissão realizada por <span className="text-zinc-400 font-bold">MPLAY</span>
            </p>
            <p className="text-zinc-800 text-xs mt-4">
              &copy; 2025 MPLAY Streaming Solutions. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      </div>
  );
}

function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}

export default App;