
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { XIcon, TrashIcon, SendIcon, MicrophoneIcon, SpeakerIcon, BroadcastIcon } from './Icons';

interface LiveAudioTestProps {
  onClose: () => void;
}

const LiveAudioTest: React.FC<LiveAudioTestProps> = ({ onClose }) => {
  const [status, setStatus] = useState<string>("Đã ngắt kết nối");
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Store the session promise
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  
  // Audio Context Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Playback scheduling
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioStream();
      if (outputAudioContextRef.current) {
          outputAudioContextRef.current.close();
      }
    };
  }, []);
  
  // Auto-scroll logs
  useEffect(() => {
      if (logsEndRef.current) {
          logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [logs]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // --- Audio Encoding Helpers (PCM 16kHz Input) ---
  const floatTo16BitPCM = (input: Float32Array) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // --- Audio Decoding Helpers (PCM 24kHz Output) ---
  const playAudioChunk = async (base64String: string) => {
      try {
          if (!outputAudioContextRef.current) {
              outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          }
          const ctx = outputAudioContextRef.current;
          
          if (ctx.state === 'suspended') {
              await ctx.resume();
          }
          
          // Decode Base64 to Binary String
          const binaryString = atob(base64String);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
          }
          
          // Convert Raw PCM 16-bit (Little Endian) to Float32
          const int16Data = new Int16Array(bytes.buffer);
          const float32Data = new Float32Array(int16Data.length);
          for (let i = 0; i < int16Data.length; i++) {
              float32Data[i] = int16Data[i] / 32768.0;
          }
          
          // Create Audio Buffer (1 Channel, 24kHz)
          const buffer = ctx.createBuffer(1, float32Data.length, 24000);
          buffer.copyToChannel(float32Data, 0);
          
          // Create Source Node
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          
          // Schedule Playback
          // If nextStartTime is in the past, reset it to now to catch up
          if (nextStartTimeRef.current < ctx.currentTime) {
              nextStartTimeRef.current = ctx.currentTime;
          }
          
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += buffer.duration;
          
          scheduledSourcesRef.current.push(source);
          setIsPlaying(true);
          
          source.onended = () => {
              scheduledSourcesRef.current = scheduledSourcesRef.current.filter(s => s !== source);
              if (scheduledSourcesRef.current.length === 0) {
                  setIsPlaying(false);
              }
          };
      } catch (error) {
          console.error("Error playing audio chunk", error);
      }
  };

  const startAudioStream = async () => {
    if (!sessionPromiseRef.current) {
        addLog("⚠️ Chưa kết nối! Hãy bấm 'Kết nối' trước.");
        return;
    }

    try {
      // Stop previous context if exists to clear buffers
      if (inputAudioContextRef.current) {
          inputAudioContextRef.current.close();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
            sampleRate: 16000, 
            channelCount: 1,
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: true
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Setup Audio Context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAudioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Setup Processor (Buffer size 4096 ~ 256ms latency)
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(inputData);
        const base64String = arrayBufferToBase64(pcmData.buffer);

        sessionPromiseRef.current?.then(session => {
            session.sendRealtimeInput({
                media: {
                    mimeType: "audio/pcm;rate=16000",
                    data: base64String
                }
            });
        });
      };

      source.connect(processor);
      processor.connect(audioContext.destination); 
      
      setIsRecording(true);
      addLog("🎙️ Đang thu âm & gửi dữ liệu...");

    } catch (e: any) {
      addLog(`❌ Lỗi Micro: ${e.message}`);
      setIsRecording(false);
    }
  };

  const stopAudioStream = () => {
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    if (inputAudioContextRef.current) {
        inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
    }
    setIsRecording(false);
    addLog("🛑 Đã tắt Micro.");
  };

  const toggleMic = () => {
    if (isRecording) {
        stopAudioStream();
    } else {
        startAudioStream();
    }
  };

  const connectToGemini = async () => {
    if (!process.env.API_KEY) {
      addLog("❌ Lỗi: Chưa có API Key!");
      return;
    }

    try {
      setIsConnecting(true);
      setStatus("⏳ Đang kết nối...");
      
      // Initialize output context on interaction
      if (!outputAudioContextRef.current) {
          outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (outputAudioContextRef.current.state === 'suspended') {
          await outputAudioContextRef.current.resume();
      }
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "Bạn là KL AI. Hãy nói tiếng Việt tự nhiên, ngắn gọn và thân thiện.",
        },
        callbacks: {
          onopen: () => {
            setStatus("✅ Đã kết nối (Sẵn sàng nói)");
            addLog("✅ WebSocket Opened.");
            setIsConnecting(false);
            setIsConnected(true);
          },
          onmessage: (message: LiveServerMessage) => {
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
               playAudioChunk(audioData);
            }
            
            if (message.serverContent?.interrupted) {
                addLog("⚠️ AI bị ngắt lời.");
                scheduledSourcesRef.current.forEach(s => {
                    try { s.stop(); } catch (e) {}
                });
                scheduledSourcesRef.current = [];
                nextStartTimeRef.current = 0;
            }

            if (message.serverContent?.turnComplete) {
                addLog("🤖 Kết thúc lượt nói.");
            }
          },
          onclose: () => {
            setStatus("🔒 Đã đóng");
            addLog("🔒 Connection closed.");
            setIsConnecting(false);
            setIsConnected(false);
            setIsRecording(false);
            stopAudioStream();
          },
          onerror: (e) => {
            setStatus("❌ Lỗi");
            addLog(`❌ Error: ${e instanceof Error ? e.message : 'Unknown'}`);
            setIsConnecting(false);
            setIsConnected(false);
            setIsRecording(false);
            stopAudioStream();
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;

    } catch (e: any) {
      setStatus("❌ Exception");
      addLog(`❌ Exception: ${e.message}`);
      setIsConnecting(false);
      setIsConnected(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-slide-in-up">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-red-500/10 to-transparent">
          <h2 className="text-lg font-bold flex items-center gap-2 text-red-500">
            <BroadcastIcon className="w-6 h-6 animate-pulse" />
            KL AI Live
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-card-hover rounded-full transition-colors">
            <XIcon className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="p-3 bg-input-bg rounded-lg border border-border text-sm text-center flex flex-col gap-1">
             <p className={`font-bold text-lg ${isConnected ? 'text-green-500' : 'text-text-secondary'}`}>
               {status}
             </p>
             {isPlaying && <p className="text-brand font-medium animate-pulse flex items-center justify-center gap-1"><SpeakerIcon className="w-4 h-4"/> AI đang nói...</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={connectToGemini}
              disabled={isConnecting || isConnected}
              className={`py-4 px-4 text-white rounded-xl font-bold transition-all shadow-lg ${isConnected ? 'bg-green-600' : 'bg-brand hover:bg-brand/90'} disabled:opacity-50`}
            >
              {isConnecting ? 'Đang nối...' : isConnected ? 'Đã kết nối' : '1. BẮT ĐẦU'}
            </button>

            <button 
              onClick={toggleMic}
              disabled={!isConnected}
              className={`py-4 px-4 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2
                ${isRecording 
                    ? 'bg-red-500 text-white animate-pulse shadow-red-500/20' 
                    : 'bg-card-hover text-text-primary border border-border hover:bg-sidebar disabled:opacity-50'}`}
            >
               <MicrophoneIcon className="w-5 h-5" />
               {isRecording ? 'TẮT MIC' : '2. BẬT MIC'}
            </button>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Logs</p>
                <button onClick={() => setLogs([])} className="text-xs text-brand hover:underline">Xóa log</button>
            </div>
            <div className="h-48 overflow-y-auto bg-black/90 text-green-400 p-3 font-mono text-xs rounded-lg border border-gray-800 shadow-inner scrollbar-thin scrollbar-thumb-gray-700">
                {logs.length === 0 && <span className="text-gray-500 italic">Chờ tín hiệu...</span>}
                {logs.map((log, i) => (
                <div key={i} className="mb-1 border-b border-gray-800/50 pb-1 break-words">{log}</div>
                ))}
                <div ref={logsEndRef} />
            </div>
          </div>
        </div>
        
        <div className="p-3 border-t border-border bg-sidebar/30 text-[10px] text-text-secondary text-center">
            Đeo tai nghe để có trải nghiệm tốt nhất. Loa đang {isPlaying ? 'BẬT 🔊' : 'chờ'}.
        </div>
      </div>
    </div>
  );
};

export default LiveAudioTest;
