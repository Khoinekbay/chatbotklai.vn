
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { XIcon, MicrophoneIcon, PhoneOffIcon, MicOffIcon, HeadphoneIcon } from './Icons';

interface LiveConversationProps {
  onClose: () => void;
}

const LiveConversation: React.FC<LiveConversationProps> = ({ onClose }) => {
  const [status, setStatus] = useState<string>("Sẵn sàng kết nối");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [topic, setTopic] = useState("free_talk");
  
  // Visualization state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  
  // Audio Context Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      stopAudioStream();
      if (outputAudioContextRef.current) outputAudioContextRef.current.close();
  };

  // --- Audio Visualizer ---
  const drawVisualizer = () => {
      if (!analyzerRef.current || !canvasRef.current) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyzerRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const draw = () => {
          if (!isConnected) return;
          
          animationRef.current = requestAnimationFrame(draw);
          analyzerRef.current!.getByteFrequencyData(dataArray);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const barWidth = (canvas.width / bufferLength) * 2.5;
          let barHeight;
          let x = 0;

          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;

          // Draw circular visualizer
          for (let i = 0; i < bufferLength; i++) {
              barHeight = dataArray[i] / 2;
              
              ctx.save();
              ctx.translate(centerX, centerY);
              ctx.rotate((i * Math.PI * 2) / bufferLength);
              
              const hue = i * 2 + 100;
              ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
              ctx.fillRect(0, 50, barWidth, barHeight); // Offset from center
              
              ctx.restore();
          }
      };
      draw();
  };

  // --- Audio Handling ---
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

  const playAudioChunk = async (base64String: string) => {
      try {
          if (!outputAudioContextRef.current) {
              outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          }
          const ctx = outputAudioContextRef.current;
          if (ctx.state === 'suspended') await ctx.resume();
          
          const binaryString = atob(base64String);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
          
          const int16Data = new Int16Array(bytes.buffer);
          const float32Data = new Float32Array(int16Data.length);
          for (let i = 0; i < int16Data.length; i++) float32Data[i] = int16Data[i] / 32768.0;
          
          const buffer = ctx.createBuffer(1, float32Data.length, 24000);
          buffer.copyToChannel(float32Data, 0);
          
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          
          if (nextStartTimeRef.current < ctx.currentTime) nextStartTimeRef.current = ctx.currentTime;
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += buffer.duration;
          
          scheduledSourcesRef.current.push(source);
          source.onended = () => {
              scheduledSourcesRef.current = scheduledSourcesRef.current.filter(s => s !== source);
          };
      } catch (error) {
          console.error("Audio playback error", error);
      }
  };

  const startAudioStream = async () => {
    try {
      if (inputAudioContextRef.current) inputAudioContextRef.current.close();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } });
      mediaStreamRef.current = stream;
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAudioContextRef.current = audioContext;
      
      // Analyzer for visualization
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 64; // Low res for simple bars
      analyzerRef.current = analyzer;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyzer);

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!isMicOn) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(inputData);
        const base64String = arrayBufferToBase64(pcmData.buffer);

        sessionPromiseRef.current?.then(session => {
            session.sendRealtimeInput({
                media: { mimeType: "audio/pcm;rate=16000", data: base64String }
            });
        });
      };

      source.connect(processor);
      processor.connect(audioContext.destination); 
      drawVisualizer();

    } catch (e: any) {
      setStatus(`Lỗi Micro: ${e.message}`);
    }
  };

  const stopAudioStream = () => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    inputAudioContextRef.current?.close();
  };

  const getSystemInstruction = () => {
      switch(topic) {
          case 'ielts': return "You are a strict but professional IELTS Examiner. Ask the user Part 1 questions about daily life, then move to Part 2 cue cards. Correct their grammar mistakes briefly after they speak.";
          case 'pronunciation': return "You are a Pronunciation Coach. Listen carefully. If the user mispronounces a word, stop them and correct it immediately. Make them repeat until it's perfect.";
          case 'debate': return "You are a skilled Debater. Choose a controversial topic and argue against the user. Challenge their logic.";
          case 'casual': default: return "You are a friendly English native speaker. Chat casually about life, hobbies, and culture. Use natural idioms and slang.";
      }
  };

  const connectToGemini = async () => {
    if (!process.env.API_KEY) { setStatus("Thiếu API Key"); return; }

    try {
      setIsConnecting(true);
      setStatus("Đang kết nối...");
      
      if (!outputAudioContextRef.current) outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (outputAudioContextRef.current.state === 'suspended') await outputAudioContextRef.current.resume();
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const instruction = getSystemInstruction();

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: instruction,
        },
        callbacks: {
          onopen: () => {
            setStatus("Đã kết nối");
            setIsConnecting(false);
            setIsConnected(true);
            startAudioStream();
          },
          onmessage: (message: LiveServerMessage) => {
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) playAudioChunk(audioData);
            if (message.serverContent?.interrupted) {
                scheduledSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
                scheduledSourcesRef.current = [];
                nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            setStatus("Đã ngắt kết nối");
            setIsConnected(false);
            stopAudioStream();
          },
          onerror: (e) => {
            setStatus("Lỗi kết nối");
            setIsConnected(false);
            stopAudioStream();
          }
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (e: any) {
      setStatus(`Lỗi: ${e.message}`);
      setIsConnecting(false);
    }
  };

  const toggleMic = () => setIsMicOn(!isMicOn);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center text-white animate-slide-in-up">
      {/* Close Button */}
      <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors z-20">
          <XIcon className="w-6 h-6" />
      </button>

      {/* Settings Overlay (Only when not connected) */}
      {!isConnected && !isConnecting && (
          <div className="absolute inset-0 bg-black/90 z-10 flex flex-col items-center justify-center p-6 space-y-8">
              <div className="text-center space-y-2">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Luyện Nói Tiếng Anh</h2>
                  <p className="text-gray-400">Chọn chủ đề để bắt đầu hội thoại</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
                  {[
                      {id: 'free_talk', label: '🗣️ Free Talk', desc: 'Trò chuyện tự nhiên'},
                      {id: 'ielts', label: '🎓 IELTS Speaking', desc: 'Mô phỏng phòng thi'},
                      {id: 'pronunciation', label: '🎙️ Pronunciation', desc: 'Sửa phát âm'},
                      {id: 'debate', label: '🔥 Debate', desc: 'Tranh luận gay gắt'}
                  ].map(t => (
                      <button
                          key={t.id}
                          onClick={() => setTopic(t.id)}
                          className={`p-6 rounded-2xl border transition-all text-left ${topic === t.id ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-500/30' : 'bg-gray-800 border-gray-700 hover:bg-gray-750'}`}
                      >
                          <h3 className="font-bold text-lg">{t.label}</h3>
                          <p className="text-sm text-gray-300 mt-1">{t.desc}</p>
                      </button>
                  ))}
              </div>

              <button 
                  onClick={connectToGemini}
                  className="px-10 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-xl rounded-full shadow-xl shadow-green-500/20 transition-transform hover:scale-105 active:scale-95 flex items-center gap-3"
              >
                  <HeadphoneIcon className="w-6 h-6" />
                  Bắt đầu cuộc gọi
              </button>
          </div>
      )}

      {/* Main Call Interface */}
      <div className="flex flex-col items-center gap-8 relative z-0 w-full h-full justify-center">
          
          {/* Status Badge */}
          <div className="px-4 py-2 bg-gray-800/50 backdrop-blur rounded-full text-sm font-medium flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
              {status}
          </div>

          {/* Visualizer / Avatar */}
          <div className="relative w-64 h-64 flex items-center justify-center">
              <canvas ref={canvasRef} width="300" height="300" className="absolute inset-0 w-full h-full opacity-50" />
              <div className={`w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-[0_0_60px_rgba(59,130,246,0.4)] z-10 transition-transform duration-300 ${isConnected ? 'scale-110' : 'scale-100 grayscale'}`}>
                  <span className="text-4xl">🤖</span>
              </div>
          </div>

          <p className="text-xl font-medium opacity-80">
              {isConnected ? "AI đang lắng nghe..." : "Đang kết nối..."}
          </p>

          {/* Controls */}
          {isConnected && (
              <div className="flex items-center gap-6 mt-8">
                  <button 
                      onClick={toggleMic}
                      className={`p-5 rounded-full transition-all ${isMicOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white text-black'}`}
                  >
                      {isMicOn ? <MicrophoneIcon className="w-6 h-6" /> : <MicOffIcon className="w-6 h-6" />}
                  </button>
                  
                  <button 
                      onClick={onClose}
                      className="p-5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 transform hover:scale-110 transition-all"
                  >
                      <PhoneOffIcon className="w-8 h-8" />
                  </button>
              </div>
          )}
      </div>
    </div>
  );
};

export default LiveConversation;
