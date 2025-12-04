import React, { useState, useEffect, useRef } from 'react';
import { Radio, StopCircle, Camera, RefreshCcw, Settings, AlertTriangle, Wifi, WifiOff, Globe, Lock, Copy, ExternalLink, Check } from 'lucide-react';
import { StreamStatus } from '../types';
import { checkFirebaseConnection, listenForViewers, sendOffer, listenForAnswer, sendIceCandidate, listenForIceCandidates } from '../services/firebase';

interface AdminPanelProps {
  onUpdate: (status: StreamStatus) => void;
  currentStatus: StreamStatus;
}

const iceServers = {
  iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }]
};

const AdminPanel: React.FC<AdminPanelProps> = ({ onUpdate, currentStatus }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'connected' | 'denied' | 'error'>('checking');

  useEffect(() => {
    const checkNet = async () => {
        const result = await checkFirebaseConnection();
        setNetworkStatus(result);
    };
    checkNet();
    const interval = setInterval(checkNet, 10000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await startCamera();
    };
    init();
    return () => {
      mounted = false;
      stopCameraInternal();
    };
  }, [facingMode]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, hasPermission]);

  // --- WebRTC Logic ---
  useEffect(() => {
    if (currentStatus === StreamStatus.LIVE && stream) {
      console.log("Iniciando servidor de sinalização...");
      
      const unsubscribe = listenForViewers(async (viewerId) => {
        console.log("Novo visualizador detectado:", viewerId);
        setViewerCount(prev => prev + 1);
        
        if (peerConnections.current.has(viewerId)) return;

        const pc = new RTCPeerConnection(iceServers);
        peerConnections.current.set(viewerId, pc);

        // Add Tracks
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });

        // ICE Candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendIceCandidate(viewerId, event.candidate, 'admin');
          }
        };

        // Create Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendOffer(viewerId, offer);

        // Listen for Answer
        listenForAnswer(viewerId, (answer) => {
           if (!pc.currentRemoteDescription) {
             pc.setRemoteDescription(new RTCSessionDescription(answer));
           }
        });

        // Listen for Viewer ICE
        listenForIceCandidates(viewerId, 'viewer', (candidate) => {
           pc.addIceCandidate(new RTCIceCandidate(candidate));
        });
      });

      return () => {
        // Cleanup all connections when stopping stream
        peerConnections.current.forEach(pc => pc.close());
        peerConnections.current.clear();
        setViewerCount(0);
        // unsubscribe is void | Unsubscribe, check implementation
      };
    }
  }, [currentStatus, stream]);


  const stopCameraInternal = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (e) { console.error(e); }
      });
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    stopCameraInternal();
    setErrorMsg('');
    try {
      let newStream: MediaStream | null = null;
      const constraints = { video: { facingMode: facingMode }, audio: true };

      try {
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr: any) {
        if (firstErr.name === 'NotReadableError' || firstErr.message?.includes('video source')) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        try {
            newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (secondErr) { throw secondErr; }
      }
      
      if (newStream) {
        streamRef.current = newStream;
        setStream(newStream);
        setHasPermission(true);
      }
    } catch (err: any) {
      setHasPermission(false);
      setStream(null);
      setErrorMsg("Erro ao acessar câmera. Verifique permissões.");
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
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    setViewerCount(0);
  };

  const copyRulesToClipboard = () => {
    const rules = `{
  "rules": {
    ".read": true,
    ".write": true
  }
}`;
    navigator.clipboard.writeText(rules);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
            <h1 className="text-xl font-serif text-white flex items-center gap-2">
                <Settings className="text-zinc-500" size={20} /> 
                Painel do Diretor
            </h1>
            <p className="text-zinc-500 text-xs mt-1">Controle de transmissão ao vivo</p>
        </div>

        <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${currentStatus === StreamStatus.LIVE ? 'bg-red-900/20 border-red-500/50 text-red-500' : 'bg-black border-zinc-700 text-zinc-500'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${currentStatus === StreamStatus.LIVE ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`}></div>
                <span className="text-xs font-bold tracking-wider">{currentStatus === StreamStatus.LIVE ? 'NO AR' : 'OFFLINE'}</span>
            </div>

            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
                networkStatus === 'connected' ? 'bg-green-900/20 border-green-500/30 text-green-500' : 
                networkStatus === 'denied' ? 'bg-orange-900/20 border-orange-500/30 text-orange-400' :
                'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}>
                {networkStatus === 'connected' && <Globe size={14} />}
                {networkStatus === 'denied' && <Lock size={14} />}
                {(networkStatus === 'error' || networkStatus === 'checking') && <WifiOff size={14} />}
                
                <span className="text-xs font-bold uppercase">
                    {networkStatus === 'connected' ? 'Conectado' : 
                     networkStatus === 'denied' ? 'Bloqueado' : 
                     networkStatus === 'checking' ? '...' : 'Erro'}
                </span>
            </div>
        </div>
      </div>

      {networkStatus === 'denied' && (
        <div className="bg-orange-950/40 border border-orange-500/40 rounded-lg p-5 animate-in fade-in slide-in-from-top-2 shadow-lg">
            <div className="flex flex-col md:flex-row gap-5">
                <div className="shrink-0">
                    <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center border border-orange-500/20">
                        <Lock className="text-orange-500" size={24} />
                    </div>
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-lg text-white mb-2">Acesso Externo Bloqueado</h3>
                    <p className="text-zinc-300 text-sm mb-4 leading-relaxed">
                        O Firebase bloqueou a conexão. Sem isso, o vídeo não chega ao seu amigo.
                        <br/><span className="text-orange-400 font-bold">Libere o acesso no console:</span>
                    </p>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 bg-black/40 p-3 rounded border border-orange-500/10">
                            <code className="text-green-400 font-mono text-xs flex-1">
                                {`{ "rules": { ".read": true, ".write": true } }`}
                            </code>
                            <button 
                                onClick={copyRulesToClipboard}
                                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors"
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? 'Copiado' : 'Copiar'}
                            </button>
                        </div>
                         <a 
                            href="https://console.firebase.google.com/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 w-full md:w-auto bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold py-2.5 px-4 rounded border border-zinc-700 transition-colors"
                        >
                            <ExternalLink size={16} />
                            Abrir Firebase Console &gt; Realtime Database &gt; Regras
                        </a>
                    </div>
                </div>
            </div>
        </div>
      )}

      <div className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-2xl relative">
          <div className="aspect-video bg-black relative group flex items-center justify-center overflow-hidden">
              {hasPermission === false ? (
                  <div className="text-center text-red-500 p-6 flex flex-col items-center max-w-md">
                      <AlertTriangle size={32} className="mb-4" />
                      <h3 className="text-white font-bold mb-2">Erro de Câmera</h3>
                      <p className="text-sm text-zinc-400 mb-6">{errorMsg}</p>
                      <button onClick={() => startCamera()} className="px-6 py-2 bg-zinc-800 rounded-full text-white text-sm font-bold border border-zinc-700">
                        Tentar Novamente
                      </button>
                  </div>
              ) : (
                <>
                    <video 
                        ref={videoRef}
                        autoPlay 
                        playsInline 
                        muted
                        className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                    />
                     
                    {/* Overlay Watermark */}
                    <div className="absolute top-6 left-6 z-20 select-none pointer-events-none opacity-90">
                        <h2 className="text-white font-serif text-lg font-bold leading-none tracking-wide text-shadow">
                            Formatura EASP 2025
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="h-0.5 w-6 bg-gold-500"></div>
                            <p className="text-gold-400 font-sans text-[10px] font-bold tracking-[0.3em] uppercase">
                                MPLAY DIRECT
                            </p>
                        </div>
                    </div>

                    <div className="absolute top-6 right-6 z-20 bg-black/60 backdrop-blur px-3 py-1 rounded text-xs text-white border border-white/10">
                       Espectadores Conectados: {viewerCount}
                    </div>

                    <div className="absolute bottom-6 right-6 z-30 flex gap-2">
                         <button onClick={toggleCamera} className="p-3 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md border border-white/10">
                            <RefreshCcw size={20} />
                         </button>
                    </div>
                </>
              )}
          </div>

          <div className="p-6 bg-zinc-950 border-t border-zinc-800 flex justify-center gap-4">
             {currentStatus !== StreamStatus.LIVE ? (
                <button 
                  onClick={handleStartStream}
                  disabled={!stream || !hasPermission}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 text-white px-12 py-4 rounded-lg font-bold tracking-wide shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
};

export default AdminPanel;