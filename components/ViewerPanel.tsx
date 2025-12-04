import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Maximize, MessageCircle, Send, Users, Heart, Signal, Video, Loader2 } from 'lucide-react';
import { StreamStatus, ChatMessage } from '../types';
import { getEventAssistantResponse } from '../services/gemini';
import { registerViewer, listenForOffer, sendAnswer, listenForIceCandidates, sendIceCandidate } from '../services/firebase';

interface ViewerPanelProps {
  status: StreamStatus;
}

const iceServers = {
  iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }]
};

const ViewerPanel: React.FC<ViewerPanelProps> = ({ status }) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'ai', text: 'Bem-vindo à transmissão da Formatura EASP 2025! Eu sou o assistente virtual da MPLAY. Posso ajudar com informações sobre o evento.', timestamp: new Date() }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Video and WebRTC
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [muted, setMuted] = useState(true); // Start muted to allow autoplay
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatOpen]);

  // WebRTC Connection Logic
  useEffect(() => {
    if (status === StreamStatus.LIVE) {
       setConnectionState('connecting');
       const viewerId = 'viewer_' + Math.random().toString(36).substr(2, 9);
       
       const startConnection = async () => {
         // 1. Announce presence
         await registerViewer(viewerId);

         // 2. Wait for Offer from Admin
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
    if (!chatInput.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: chatInput,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    const reply = await getEventAssistantResponse(userMsg.text);
    
    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: reply,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  };

  const toggleMute = () => {
    if (videoRef.current) {
        videoRef.current.muted = !muted;
        setMuted(!muted);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full">
      {/* Video Player Section */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-[0_0_40px_rgba(234,179,8,0.1)] group border border-zinc-800">
            
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
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30">
                      <button 
                        onClick={toggleMute}
                        className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                      >
                          {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                      </button>
                      <div className="text-white/80 text-xs font-mono tracking-widest">
                          SINAL: WEBRTC P2P
                      </div>
                  </div>
                </>
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 text-white bg-[url('https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center bg-blend-multiply">
                    <div className="mb-6 p-6 rounded-full bg-zinc-950/50 backdrop-blur border border-zinc-800 text-zinc-400 animate-pulse">
                        {status === StreamStatus.ENDED ? <Video size={48} /> : <Signal size={48} />}
                    </div>
                    <h3 className="text-3xl font-serif mb-3 text-center text-white">
                        {status === StreamStatus.ENDED ? "Transmissão Encerrada" : "Aguardando Sinal"}
                    </h3>
                    <p className="text-zinc-300 font-light text-lg max-w-md text-center">
                        {status === StreamStatus.ENDED ? "Obrigado por acompanhar a Formatura EASP 2025." : "O evento começará em breve."}
                    </p>
                    {status !== StreamStatus.ENDED && (
                        <div className="mt-8 flex items-center gap-3 text-gold-500/80 text-sm tracking-widest uppercase">
                            <span className="w-2 h-2 rounded-full bg-gold-500 animate-pulse"></span>
                            Aguardando Diretor
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Stream Info */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 shadow-xl">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl lg:text-3xl font-serif text-white">Formatura EASP 2025</h1>
                        {status === StreamStatus.LIVE && (
                            <span className="bg-red-900/30 text-red-500 border border-red-900/50 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                Ao Vivo
                            </span>
                        )}
                    </div>
                    <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
                        Cerimônia oficial de colação de grau. Acompanhe ao vivo a entrega dos diplomas e as celebrações dos formandos.
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-black/40 p-3 rounded-lg border border-zinc-800/50">
                    <div className="w-10 h-10 bg-gold-600 rounded flex items-center justify-center text-black font-bold text-xs">
                        MP
                    </div>
                    <div className="text-left">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">Transmissão</p>
                        <p className="text-sm text-gold-500 font-bold">MPLAY SISTEMAS</p>
                    </div>
                </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 border-t border-zinc-800 pt-4">
                <button 
                  onClick={() => setChatOpen(!chatOpen)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${chatOpen ? 'bg-gold-600 text-black' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}
                >
                    <MessageCircle size={18} />
                    {chatOpen ? 'Fechar Chat' : 'Chat ao Vivo'}
                </button>
                <button className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-sm text-white font-medium transition-colors group">
                    <Heart size={18} className="group-hover:text-red-500 transition-colors group-hover:fill-red-500" />
                    Curtir Transmissão
                </button>
            </div>
        </div>
      </div>

      {/* Chat Section */}
      <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-zinc-950/95 backdrop-blur-xl border-l border-zinc-800 flex flex-col transition-transform duration-300 shadow-2xl lg:relative lg:translate-x-0 lg:bg-zinc-900 lg:shadow-none lg:border-l-0 lg:rounded-xl lg:h-auto ${chatOpen ? 'translate-x-0' : 'translate-x-full lg:hidden'}`}>
        <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex justify-between items-center rounded-t-xl">
            <div>
                <h3 className="font-serif text-white text-lg">Chat do Evento</h3>
                <p className="text-xs text-zinc-500">Tire suas dúvidas com a IA</p>
            </div>
            <button onClick={() => setChatOpen(false)} className="lg:hidden p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                ✕
            </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-900/50 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                        msg.sender === 'user' 
                        ? 'bg-zinc-800 text-white rounded-br-none border border-zinc-700' 
                        : 'bg-gradient-to-br from-gold-900/20 to-zinc-900 border border-gold-500/20 text-gray-200 rounded-bl-none'
                    }`}>
                        {msg.sender === 'ai' && (
                            <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-gold-500/10">
                                <span className="text-[10px] text-gold-500 font-bold tracking-wider uppercase">Assistente MPLAY</span>
                            </div>
                        )}
                        {msg.text}
                    </div>
                    <span className="text-[10px] text-zinc-600 mt-1 px-1">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            ))}
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
                    disabled={!chatInput.trim() || isTyping}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gold-600 hover:bg-gold-500 text-black rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                >
                    <Send size={18} />
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default ViewerPanel;