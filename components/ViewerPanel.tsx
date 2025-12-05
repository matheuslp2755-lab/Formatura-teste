import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Maximize, MessageCircle, Send, Users, Heart, Signal, Video, Loader2, Clock, User, Minimize, GraduationCap, ImageOff, Trash2 } from 'lucide-react';
import { StreamStatus, ChatMessage, Graduate } from '../types';
import { registerViewer, listenForOffer, sendAnswer, listenForIceCandidates, sendIceCandidate, listenToCountdown, sendChatMessage, listenToChatMessages, listenToGraduates, deleteChatMessage } from '../services/firebase';
// @ts-ignore
import confetti from 'canvas-confetti';

interface ViewerPanelProps {
  status: StreamStatus;
}

const iceServers = {
  iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }]
};

const ViewerPanel: React.FC<ViewerPanelProps> = ({ status }) => {
  // User Identity State
  const [username, setUsername] = useState<string>('');
  const [tempUsername, setTempUsername] = useState('');
  const [showNameModal, setShowNameModal] = useState(true);

  // Chat State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Graduates Data
  const [graduates, setGraduates] = useState<Graduate[]>([]);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  // Video and WebRTC
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [muted, setMuted] = useState(true); 
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Countdown State
  const [targetTime, setTargetTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatOpen]);

  // Load Chat Messages
  useEffect(() => {
    // Agora o listener retorna a lista completa atualizada
    const unsubscribe = listenToChatMessages((msgs) => {
       setMessages(msgs);
    });
    return () => unsubscribe();
  }, []);

  // Load Graduates Data with real time updates
  useEffect(() => {
    const unsubscribe = listenToGraduates((data) => {
        setImgErrors({});
        setGraduates(data);
    });
    return () => unsubscribe();
  }, []);

  // Listen for countdown
  useEffect(() => {
    const unsubscribe = listenToCountdown((val) => {
        setTargetTime(val);
    });
    return () => unsubscribe();
  }, []);

  // Update Countdown Timer
  useEffect(() => {
    if (!targetTime) {
        setTimeLeft('');
        return;
    }

    const interval = setInterval(() => {
        const now = Date.now();
        const diff = targetTime - now;

        if (diff <= 0) {
            setTimeLeft('00:00:00');
            clearInterval(interval);
        } else {
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            const str = 
                (hours > 0 ? hours.toString().padStart(2, '0') + ':' : '') + 
                minutes.toString().padStart(2, '0') + ':' + 
                seconds.toString().padStart(2, '0');
            setTimeLeft(str);
        }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime]);


  // WebRTC Connection Logic
  useEffect(() => {
    if (status === StreamStatus.LIVE) {
       setConnectionState('connecting');
       const viewerId = 'viewer_' + Math.random().toString(36).substr(2, 9);
       
       const startConnection = async () => {
         await registerViewer(viewerId);

         listenForOffer(viewerId, async (offer) => {
            console.log("Oferta recebida do Admin");
            
            if (peerConnection.current) peerConnection.current.close();
            
            const pc = new RTCPeerConnection(iceServers);
            peerConnection.current = pc;

            pc.onicecandidate = (event) => {
               if (event.candidate) {
                 sendIceCandidate(viewerId, event.candidate, 'viewer');
               }
            };

            pc.ontrack = (event) => {
               console.log("Track recebido:", event.streams[0]);
               if (videoRef.current) {
                 videoRef.current.srcObject = event.streams[0];
                 videoRef.current.play().catch(e => console.error("Autoplay prevent:", e));
                 setConnectionState('connected');
               }
            };
            
            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'connected') setConnectionState('connected');
                if (pc.connectionState === 'failed') setConnectionState('failed');
            };

            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendAnswer(viewerId, answer);

            listenForIceCandidates(viewerId, 'admin', (candidate) => {
                pc.addIceCandidate(new RTCIceCandidate(candidate));
            });
         });
       };

       startConnection();

       return () => {
         if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
         }
         setConnectionState('disconnected');
       };
    } else {
        setConnectionState('disconnected');
    }
  }, [status]);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !username) return;

    await sendChatMessage({
        sender: username,
        text: chatInput,
        timestamp: Date.now()
    });

    setChatInput('');
  };

  const handleDeleteMessage = async (msgId: string) => {
    // Immediate action as requested by user ("Quando apertar... deve ser apagado")
    await deleteChatMessage(msgId);
  };

  const toggleMute = () => {
    if (videoRef.current) {
        videoRef.current.muted = !muted;
        setMuted(!muted);
    }
  };

  // --- FULLSCREEN LOGIC FIX ---
  const toggleFullScreen = () => {
    const videoEl = videoRef.current;
    const containerEl = containerRef.current;

    if (!videoEl || !containerEl) return;

    // 1. Suporte Específico para iOS (iPhone)
    // O iOS não suporta Fullscreen API em divs, apenas webkitEnterFullscreen no elemento de vídeo.
    if ((videoEl as any).webkitSupportsFullscreen) {
        if ((videoEl as any).webkitDisplayingFullscreen) {
            (videoEl as any).webkitExitFullscreen();
        } else {
            (videoEl as any).webkitEnterFullscreen();
        }
        return;
    }

    // 2. Suporte Padrão (Android, Desktop)
    if (!document.fullscreenElement) {
        if (containerEl.requestFullscreen) {
            containerEl.requestFullscreen().then(() => {
                setIsFullscreen(true);
            }).catch(err => {
                console.warn("Fullscreen container failed, trying video fallback:", err);
                // Fallback: Tenta fullscreen direto no vídeo se o container falhar
                if (videoEl.requestFullscreen) videoEl.requestFullscreen();
            });
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen().then(() => setIsFullscreen(false));
        }
    }
  };

  // Listeners para detectar saída do modo Fullscreen (via ESC ou botão nativo do celular)
  useEffect(() => {
    const handleFSChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
    };

    // iOS dispara 'webkitendfullscreen' quando o usuário fecha o player nativo
    const handleIOSExit = () => {
        setIsFullscreen(false);
    };

    // Standard
    document.addEventListener('fullscreenchange', handleFSChange);
    
    // iOS Listener
    const videoEl = videoRef.current;
    if (videoEl) {
        videoEl.addEventListener('webkitendfullscreen', handleIOSExit);
    }

    return () => {
        document.removeEventListener('fullscreenchange', handleFSChange);
        if (videoEl) {
            videoEl.removeEventListener('webkitendfullscreen', handleIOSExit);
        }
    };
  }, [status]); // Re-bind se o status mudar (pois o elemento de vídeo é recriado)


  const handleNameSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (tempUsername.trim()) {
          setUsername(tempUsername.trim());
          setShowNameModal(false);
          setChatOpen(true);
          
          // Trigger Confetti Celebration
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            zIndex: 9999, // Ensure it appears above other elements
            colors: ['#EAB308', '#FACC15', '#CA8A04', '#FFFFFF'] // Gold & White
          });
      }
  };

  const handleImgError = (id: string) => {
    setImgErrors(prev => ({ ...prev, [id]: true }));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full relative">
      
      {/* Username Modal Overlay */}
      {showNameModal && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold-500 to-transparent"></div>
                
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 mb-4 text-gold-500">
                        <User size={32} />
                    </div>
                    <h2 className="text-2xl font-serif text-white">Bem-vindo(a)</h2>
                    <p className="text-zinc-500 text-sm mt-2">Como você gostaria de ser identificado no chat?</p>
                </div>

                <form onSubmit={handleNameSubmit} className="flex flex-col gap-4">
                    <input 
                        type="text" 
                        value={tempUsername}
                        onChange={(e) => setTempUsername(e.target.value)}
                        placeholder="Seu nome ou apelido"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-3 px-4 text-white text-center focus:outline-none focus:border-gold-500 transition-colors"
                        autoFocus
                    />
                    <button 
                        type="submit"
                        disabled={!tempUsername.trim()}
                        className="w-full bg-gold-600 hover:bg-gold-500 text-black font-bold py-3 rounded-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Entrar na Transmissão
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* Video Player Section */}
      <div className="flex-1 flex flex-col gap-4">
        <div 
            ref={containerRef} 
            className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-[0_0_40px_rgba(234,179,8,0.1)] group border border-zinc-800"
        >
            
            {/* Broadcast Overlay / Watermark */}
            <div className="absolute top-6 left-6 z-20 select-none pointer-events-none drop-shadow-md">
                <h2 className="text-white font-serif text-xl lg:text-2xl font-bold leading-none tracking-wide text-shadow">
                    Formatura EASP 2025
                </h2>
                <div className="flex items-center gap-2 mt-1">
                    <div className="h-0.5 w-8 bg-gold-500"></div>
                    <p className="text-gold-400 font-sans text-xs font-bold tracking-[0.3em] uppercase">
                        MPLAY
                    </p>
                </div>
            </div>

            {status === StreamStatus.LIVE ? (
                <>
                  {/* Real WebRTC Feed */}
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted={muted}
                    // Importante para iOS não abrir fullscreen automaticamente, permitindo nosso controle
                  />
                  
                  {/* Connecting State */}
                  {connectionState === 'connecting' && (
                     <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                        <div className="flex flex-col items-center gap-3">
                           <Loader2 className="animate-spin text-gold-500" size={32} />
                           <p className="text-white text-sm font-bold tracking-widest uppercase">Estabelecendo Conexão Segura...</p>
                        </div>
                     </div>
                  )}

                  {/* LIVE Indicator Overlay */}
                  <div className="absolute top-6 right-6 z-20 flex items-center gap-2 bg-red-600/90 backdrop-blur-sm text-white px-3 py-1 rounded-sm shadow-lg animate-pulse pointer-events-none">
                     <Signal size={14} />
                     <span className="text-xs font-bold tracking-widest uppercase">AO VIVO</span>
                  </div>

                  {/* Player Controls (Custom) */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30">
                      <div className="flex items-center gap-4">
                          <button 
                            onClick={toggleMute}
                            className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                          >
                              {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                          </button>
                          <div className="text-white/80 text-xs font-mono tracking-widest border-l border-white/20 pl-4">
                              SINAL: WEBRTC P2P
                          </div>
                      </div>

                      <button 
                        onClick={toggleFullScreen}
                        className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                        title="Tela Cheia"
                      >
                          {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
                      </button>
                  </div>
                </>
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 text-white">
                    {/* Background Effect */}
                    <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-black opacity-80"></div>
                    
                    <div className="z-10 flex flex-col items-center p-8 text-center">
                        <div className="mb-6 p-6 rounded-full bg-zinc-900/50 backdrop-blur border border-zinc-800 text-gold-500 shadow-[0_0_30px_rgba(234,179,8,0.1)]">
                            {targetTime && timeLeft ? <Clock size={48} className="animate-pulse" /> : <Video size={48} />}
                        </div>
                        
                        {targetTime && timeLeft ? (
                            <>
                                <h3 className="text-sm font-bold text-gold-500 uppercase tracking-[0.3em] mb-4">A transmissão começará em</h3>
                                <div className="text-5xl md:text-7xl font-mono font-bold text-white tabular-nums tracking-tight">
                                    {timeLeft}
                                </div>
                            </>
                        ) : (
                            <>
                                <h3 className="text-3xl font-serif mb-3 text-center text-white">
                                    {status === StreamStatus.ENDED ? "Transmissão Encerrada" : "Aguardando Início"}
                                </h3>
                                <p className="text-zinc-400 font-light text-lg max-w-md text-center">
                                    {status === StreamStatus.ENDED ? "Obrigado por acompanhar a Formatura EASP 2025." : "O sinal será liberado em breve."}
                                </p>
                            </>
                        )}
                        
                        {status !== StreamStatus.ENDED && !targetTime && (
                            <div className="mt-8 flex items-center gap-3 text-zinc-600 text-sm tracking-widest uppercase">
                                <span className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse"></span>
                                Aguardando Diretor
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Stream Info + Gallery */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 shadow-xl">
            {/* Header / Buttons */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl lg:text-3xl font-serif text-white">Formatura EASP 2025</h1>
                        {status === StreamStatus.LIVE && (
                            <span className="bg-red-900/30 text-red-500 border border-red-900/50 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                Ao Vivo
                            </span>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* Only show chat buttons if username is set */}
                    {username && (
                        <div className="flex flex-wrap gap-4 border-l border-zinc-800 pl-4">
                            <button 
                            onClick={() => setChatOpen(!chatOpen)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${chatOpen ? 'bg-gold-600 text-black' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}
                            >
                                <MessageCircle size={18} />
                                {chatOpen ? 'Fechar Chat' : 'Bate-papo'}
                            </button>
                            <button className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-sm text-white font-medium transition-colors group">
                                <Heart size={18} className="group-hover:text-red-500 transition-colors group-hover:fill-red-500" />
                                Curtir
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Graduates Gallery Section */}
            <div className="border-t border-zinc-800 pt-6">
                <div className="flex items-center gap-2 mb-4">
                     <GraduationCap className="text-gold-500" size={18} />
                     <h3 className="text-zinc-400 font-serif text-xs tracking-widest uppercase font-bold">Formandos em Destaque</h3>
                </div>
                
                {graduates.length === 0 ? (
                    <div className="py-4 text-center border border-dashed border-zinc-800 rounded-lg">
                        <p className="text-zinc-500 text-sm">A lista de formandos será atualizada em breve.</p>
                    </div>
                ) : (
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-700">
                        {graduates.map(grad => (
                            <div key={grad.id} className="flex-shrink-0 group cursor-pointer">
                                {/* Card size: w-24 h-32 */}
                                <div className="relative w-24 h-32 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-950 group-hover:border-gold-500 transition-colors">
                                    {grad.imageUrl && !imgErrors[grad.id] ? (
                                        <img 
                                            src={grad.imageUrl} 
                                            alt={grad.name} 
                                            onError={() => handleImgError(grad.id)}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-600">
                                            {grad.imageUrl ? <ImageOff size={24} className="mb-1" /> : <User size={24} className="mb-1" />}
                                        </div>
                                    )}
                                    
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80"></div>
                                    <div className="absolute bottom-0 left-0 right-0 p-2">
                                        <p className="text-white text-xs font-bold leading-tight truncate">{grad.name}</p>
                                        <p className="text-gold-500 text-[10px] truncate">{grad.course}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Chat Section */}
      {/* Only render chat container if username is set */}
      {username && (
          <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-zinc-950/95 backdrop-blur-xl border-l border-zinc-800 flex flex-col transition-transform duration-300 shadow-2xl lg:relative lg:translate-x-0 lg:bg-zinc-900 lg:shadow-none lg:border-l-0 lg:rounded-xl lg:h-auto ${chatOpen ? 'translate-x-0' : 'translate-x-full lg:hidden'}`}>
            <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex justify-between items-center rounded-t-xl">
                <div>
                    <h3 className="font-serif text-white text-lg">Chat da Família</h3>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <p className="text-xs text-zinc-500">Conectado como <span className="text-white font-bold">{username}</span></p>
                    </div>
                </div>
                <button onClick={() => setChatOpen(false)} className="lg:hidden p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                    ✕
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-900/50 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                {messages.length === 0 && (
                    <div className="text-center text-zinc-600 text-xs py-8">
                        Seja o primeiro a enviar uma mensagem!
                    </div>
                )}
                {messages.map((msg) => {
                    const isMe = msg.sender === username;
                    return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group/msg`}>
                            <div className="flex items-center gap-2 max-w-[90%]">
                                {/* Botão de Deletar (Só aparece se for mensagem do usuário) */}
                                {isMe && (
                                    <button 
                                        onClick={() => handleDeleteMessage(msg.id)}
                                        className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                                        title="Apagar minha mensagem"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}

                                <div className={`flex-1 rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                    isMe 
                                    ? 'bg-zinc-800 text-white rounded-br-none border border-zinc-700' 
                                    : 'bg-gradient-to-br from-gold-900/20 to-zinc-900 border border-gold-500/20 text-gray-200 rounded-bl-none'
                                }`}>
                                    {!isMe && (
                                        <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-white/5">
                                            <span className="text-[10px] font-bold tracking-wider uppercase text-gold-500">
                                                {msg.sender}
                                            </span>
                                        </div>
                                    )}
                                    {msg.text}
                                </div>
                            </div>
                            <span className="text-[10px] text-zinc-600 mt-1 px-1">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-zinc-950 border-t border-zinc-800 rounded-b-xl">
                <div className="relative">
                    <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-3.5 pl-5 pr-14 text-sm text-white focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 placeholder-zinc-600 transition-all"
                    />
                    <button 
                        type="submit"
                        disabled={!chatInput.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gold-600 hover:bg-gold-500 text-black rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </form>
        </div>
      )}
    </div>
  );
};

export default ViewerPanel;