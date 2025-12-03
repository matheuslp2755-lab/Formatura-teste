import React, { useState, useEffect, useRef } from 'react';
import { Radio, StopCircle, Camera, RefreshCcw, Mic, Settings, AlertTriangle } from 'lucide-react';
import { StreamStatus } from '../types';

interface AdminPanelProps {
  onUpdate: (status: StreamStatus) => void;
  currentStatus: StreamStatus;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onUpdate, currentStatus }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Initialize Camera when facing mode changes
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  // Attach stream to video element whenever it becomes available and permitted
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, hasPermission]);

  const startCamera = async () => {
    try {
      // Clean up previous stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      setErrorMsg('');
      let newStream: MediaStream | null = null;

      try {
        // Try with requested constraints (e.g. specific camera)
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode },
          audio: true
        });
      } catch (firstErr) {
        console.warn("Preferred camera constraints failed, retrying with basic config...", firstErr);
        // Fallback: Try any available video/audio
        try {
            newStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
        } catch (secondErr) {
             throw secondErr; // If basic fails, then we really have an error
        }
      }
      
      if (newStream) {
        setStream(newStream);
        setHasPermission(true);
      }
      
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      setHasPermission(false);
      // Simplify error message for user
      let msg = "Não foi possível acessar a câmera.";
      if (err.name === 'NotAllowedError') msg = "Permissão de câmera/microfone negada.";
      else if (err.name === 'NotFoundError') msg = "Nenhuma câmera encontrada.";
      else if (err.name === 'NotReadableError') msg = "A câmera já está em uso por outro app.";
      else if (err.message) msg = err.message;
      
      setErrorMsg(msg);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleStartStream = () => {
    if (hasPermission && stream) {
        onUpdate(StreamStatus.LIVE);
    }
  };

  const handleStopStream = () => {
    onUpdate(StreamStatus.ENDED);
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Control Header */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-zinc-800 pb-6">
        <div>
            <h1 className="text-2xl font-serif text-white flex items-center gap-2">
                <Settings className="text-zinc-500" /> 
                Painel do Diretor
            </h1>
            <p className="text-zinc-500 text-sm mt-1">Controle de transmissão ao vivo</p>
        </div>
        
        <div className="flex items-center gap-3">
             <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${currentStatus === StreamStatus.LIVE ? 'bg-red-900/20 border-red-500/50 text-red-500' : 'bg-zinc-900 border-zinc-700 text-zinc-500'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${currentStatus === StreamStatus.LIVE ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`}></div>
                <span className="text-xs font-bold tracking-wider">{currentStatus === StreamStatus.LIVE ? 'NO AR' : 'OFFLINE'}</span>
             </div>
        </div>
      </div>

      {/* Main Camera Feed */}
      <div className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-2xl relative">
          
          <div className="aspect-video bg-black relative group flex items-center justify-center overflow-hidden">
              {hasPermission === false ? (
                  <div className="text-center text-red-500 p-6 flex flex-col items-center max-w-md">
                      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle size={32} />
                      </div>
                      <h3 className="text-white font-bold mb-2">Erro de Câmera</h3>
                      <p className="text-sm text-zinc-400 mb-6">{errorMsg}</p>
                      <button onClick={startCamera} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-white text-sm font-bold transition-colors border border-zinc-700">
                        Tentar Novamente
                      </button>
                  </div>
              ) : (
                <>
                    <video 
                        ref={videoRef}
                        autoPlay 
                        playsInline 
                        muted // Muted locally to prevent feedback
                        className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                    />
                     
                    {/* Overlay Watermark (Simulating Broadcast Output) */}
                    <div className="absolute top-6 left-6 z-20 select-none pointer-events-none opacity-90">
                        <h2 className="text-white font-serif text-lg font-bold leading-none tracking-wide text-shadow">
                            Formatura EASP 2025
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="h-0.5 w-6 bg-gold-500"></div>
                            <p className="text-gold-400 font-sans text-[10px] font-bold tracking-[0.3em] uppercase">
                                MPLAY
                            </p>
                        </div>
                    </div>

                    {/* Camera Controls Overlay */}
                    <div className="absolute bottom-6 right-6 z-30 flex gap-2">
                         <button 
                            onClick={toggleCamera}
                            className="p-3 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md border border-white/10 transition-all active:scale-95"
                            title="Virar Câmera"
                        >
                            <RefreshCcw size={20} />
                         </button>
                         <div className="p-3 bg-red-500/10 text-red-500 rounded-full backdrop-blur-md border border-red-500/20 animate-pulse">
                            <Mic size={20} />
                         </div>
                    </div>
                </>
              )}
          </div>

          <div className="p-6 bg-zinc-950 border-t border-zinc-800 flex justify-center gap-4">
             {currentStatus !== StreamStatus.LIVE ? (
                <button 
                  onClick={handleStartStream}
                  disabled={!stream || !hasPermission}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white px-12 py-4 rounded-lg font-bold tracking-wide shadow-lg transition-all transform hover:scale-105"
                >
                  <Radio size={20} />
                  INICIAR TRANSMISSÃO
                </button>
             ) : (
                <button 
                  onClick={handleStopStream}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-red-900/50 text-red-400 px-12 py-4 rounded-lg font-bold tracking-wide transition-all"
                >
                  <StopCircle size={20} />
                  ENCERRAR TRANSMISSÃO
                </button>
             )}
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-lg">
              <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Status do Sistema</h3>
              <div className="flex items-center gap-2 text-green-500 text-sm">
                  <div className={`w-2 h-2 rounded-full ${stream ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  {stream ? 'Câmera Ativa' : 'Câmera Inativa'}
              </div>
              <div className="flex items-center gap-2 text-green-500 text-sm mt-1">
                  <div className={`w-2 h-2 rounded-full ${stream ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  {stream ? 'Microfone Ativo' : 'Microfone Inativo'}
              </div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-lg">
              <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Audiência</h3>
              <p className="text-2xl font-serif text-white">Simulado</p>
          </div>
      </div>
    </div>
  );
};

export default AdminPanel;