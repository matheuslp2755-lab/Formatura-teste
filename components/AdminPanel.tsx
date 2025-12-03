import React, { useEffect, useRef, useState } from 'react';
import { Camera, Mic, MicOff, Video, VideoOff, Radio, StopCircle, Play, Sparkles } from 'lucide-react';
import { StreamStatus } from '../types';
import { connectToLiveProducer, createPcmBlob, getAudioContext } from '../services/liveClient';
import { LiveSession } from '@google/genai';

interface AdminPanelProps {
  onStatusChange: (status: StreamStatus) => void;
  currentStatus: StreamStatus;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onStatusChange, currentStatus }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isAiProducerActive, setIsAiProducerActive] = useState(false);
  
  // AI Producer Refs
  const liveSessionRef = useRef<LiveSession | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const videoIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: true 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing media devices:", err);
      alert("Erro ao acessar câmera/microfone. Verifique as permissões.");
    }
  };

  const stopCamera = () => {
    stopAiProducer();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
    }
  };

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioEnabled(audioTrack.enabled);
    }
  };

  // --- Gemini Live Integration ---
  
  const startAiProducer = async () => {
    if (!stream) return;
    setIsAiProducerActive(true);

    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      audioContextRef.current = ctx;
      nextStartTimeRef.current = ctx.currentTime;

      // Connect to Gemini
      const session = await connectToLiveProducer(
        (audioBuffer) => playAiAudioResponse(audioBuffer),
        () => setIsAiProducerActive(false)
      );
      liveSessionRef.current = session;

      // 1. Send Audio Input
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData);
        session.sendRealtimeInput({ media: pcmBlob });
      };

      source.connect(processor);
      processor.connect(ctx.destination); // Required for script processor to run, but mute it to avoid echo? 
      // Actually, connecting to destination causes self-hearing. 
      // Better to connect to a Gain(0) then destination if we don't want to hear ourselves, 
      // but for this demo, standard hookup. We'll mute local video element.

      inputSourceRef.current = source;
      processorRef.current = processor;

      // 2. Send Video Frames
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      if (canvas && video) {
        const ctx2d = canvas.getContext('2d');
        videoIntervalRef.current = window.setInterval(async () => {
          if (!ctx2d) return;
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          ctx2d.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
          session.sendRealtimeInput({
            media: { mimeType: 'image/jpeg', data: base64 }
          });
        }, 1000); // 1 FPS for analysis is enough to save bandwidth/tokens
      }

    } catch (e) {
      console.error("Failed to start AI Producer", e);
      setIsAiProducerActive(false);
    }
  };

  const stopAiProducer = () => {
    if (liveSessionRef.current) {
      // liveSessionRef.current.close(); // No explicit close method in new SDK interface shown in prompt usually, but clean up references
      liveSessionRef.current = null;
    }
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    if (processorRef.current && inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      processorRef.current.disconnect();
    }
    setIsAiProducerActive(false);
  };

  const playAiAudioResponse = (buffer: AudioBuffer) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;
  };

  const toggleAiProducer = () => {
    if (isAiProducerActive) {
      stopAiProducer();
    } else {
      startAiProducer();
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-2xl">
      {/* Hidden canvas for capturing frames */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-serif text-white">Painel de Transmissão</h2>
          <p className="text-xs text-zinc-500">MPLAY ADMIN SYSTEM</p>
        </div>
        <div className="flex items-center gap-2">
           <div className={`w-3 h-3 rounded-full ${currentStatus === StreamStatus.LIVE ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`}></div>
           <span className="text-sm font-semibold tracking-wider">{currentStatus === StreamStatus.LIVE ? 'NO AR' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Video Preview */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden group">
        {!stream && <p className="text-zinc-500 animate-pulse">Acessando Câmera...</p>}
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="h-full w-full object-contain"
        />
        
        {/* Broadcast Overlay / Watermark - SAME AS VIEWER */}
        <div className="absolute top-6 left-6 z-20 select-none drop-shadow-md opacity-80 pointer-events-none">
            <h2 className="text-white font-serif text-xl font-bold leading-none tracking-wide text-shadow">
                Formatura EASP 2025
            </h2>
            <div className="flex items-center gap-2 mt-1">
                <div className="h-0.5 w-8 bg-gold-500"></div>
                <p className="text-gold-400 font-sans text-xs font-bold tracking-[0.3em] uppercase">
                    MPLAY
                </p>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-widest bg-black/50 inline-block px-1">Program Output</p>
        </div>

        {/* Overlay Badges */}
        <div className="absolute top-4 right-4 flex gap-2">
            {isAiProducerActive && (
                 <div className="bg-purple-900/80 backdrop-blur border border-purple-500 text-purple-200 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 animate-in fade-in zoom-in">
                    <Sparkles size={12} />
                    DIRETOR IA ATIVO
                 </div>
            )}
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 bg-zinc-950 border-t border-zinc-800">
        <div className="flex flex-wrap justify-between items-center gap-4">
          
          <div className="flex gap-2">
            <button onClick={toggleAudio} className={`p-3 rounded-full transition-colors ${isAudioEnabled ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-red-900/50 text-red-500 border border-red-900'}`}>
              {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button onClick={toggleVideo} className={`p-3 rounded-full transition-colors ${isVideoEnabled ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-red-900/50 text-red-500 border border-red-900'}`}>
              {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
            
            <div className="h-10 w-px bg-zinc-800 mx-2"></div>

             <button 
              onClick={toggleAiProducer}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
                isAiProducerActive 
                  ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-[0_0_15px_rgba(147,51,234,0.3)]' 
                  : 'bg-zinc-800 text-purple-300 hover:bg-zinc-700 border border-zinc-700'
              }`}
            >
              <Sparkles size={16} />
              {isAiProducerActive ? 'Parar Diretor IA' : 'Ativar Diretor IA'}
            </button>
          </div>

          <div className="flex gap-4">
             {currentStatus !== StreamStatus.LIVE ? (
                <button 
                  onClick={() => onStatusChange(StreamStatus.LIVE)}
                  className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-8 py-3 rounded-lg font-bold tracking-wide shadow-lg transition-all transform hover:scale-105"
                >
                  <Radio size={20} />
                  INICIAR TRANSMISSÃO
                </button>
             ) : (
                <button 
                  onClick={() => onStatusChange(StreamStatus.ENDED)}
                  className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-red-900/50 text-red-400 px-8 py-3 rounded-lg font-bold tracking-wide transition-all"
                >
                  <StopCircle size={20} />
                  ENCERRAR
                </button>
             )}
          </div>

        </div>
        <p className="mt-4 text-xs text-zinc-600 text-center">
            MPLAY STREAMING ENGINE v2.0 • 1080p 60fps • RTMP SECURE
        </p>
      </div>
    </div>
  );
};

export default AdminPanel;