import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import ViewerPanel from './components/ViewerPanel';
import AdminPanel from './components/AdminPanel';
import { StreamStatus } from './types';
import { Video } from 'lucide-react';

function App() {
  // Initialize state from localStorage to persist across refreshes
  const [status, setStatus] = useState<StreamStatus>(() => {
    const saved = localStorage.getItem('mplay_stream_status');
    return (saved as StreamStatus) || StreamStatus.OFFLINE;
  });

  // Cross-tab synchronization
  useEffect(() => {
    const channel = new BroadcastChannel('mplay_sync_channel');
    
    // Listen for updates from other tabs (e.g. Admin tab)
    channel.onmessage = (event) => {
      if (event.data && event.data.type === 'STATUS_UPDATE') {
        setStatus(event.data.status);
      }
    };

    // Also listen to storage events as a fallback/redundancy
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mplay_stream_status' && e.newValue) {
        setStatus(e.newValue as StreamStatus);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      channel.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleStatusChange = (newStatus: StreamStatus) => {
    setStatus(newStatus);
    // Persist
    localStorage.setItem('mplay_stream_status', newStatus);
    // Broadcast to other tabs
    const channel = new BroadcastChannel('mplay_sync_channel');
    channel.postMessage({ type: 'STATUS_UPDATE', status: newStatus });
    channel.close();
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-black text-gray-100 flex flex-col font-sans selection:bg-gold-500/30">
        
        {/* Navigation / Header */}
        <nav className="border-b border-zinc-900 bg-black/50 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-8 h-8 bg-gold-600 rounded flex items-center justify-center">
                <Video className="text-black" size={18} />
              </div>
              <div className="flex flex-col">
                <span className="font-serif font-bold text-white leading-none tracking-wide group-hover:text-gold-400 transition-colors">MPLAY</span>
                <span className="text-[10px] text-zinc-500 tracking-[0.2em] uppercase">Transmission</span>
              </div>
            </Link>

            <div className="flex items-center gap-4">
              {status === StreamStatus.LIVE && (
                <span className="hidden md:flex items-center gap-2 px-3 py-1 bg-red-900/20 border border-red-900/50 rounded-full text-red-500 text-xs font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  AO VIVO AGORA
                </span>
              )}
              <Link to="/admin" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                Área Admin
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 flex flex-col">
          <Routes>
            <Route path="/" element={<ViewerPanel status={status} />} />
            <Route path="/admin" element={
              <div className="max-w-6xl mx-auto w-full h-[80vh]">
                  <AdminPanel 
                    currentStatus={status} 
                    onStatusChange={handleStatusChange} 
                  />
              </div>
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
              &copy; 2025 MPLAY Streaming Solutions. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
}

export default App;