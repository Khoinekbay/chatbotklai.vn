

import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, AttachmentIcon, XIcon, MicrophoneIcon, FileIcon, ScanIcon } from './Icons';

interface ChatInputProps {
  onSendMessage: (text: string, files: { name: string; data: string; mimeType: string }[]) => void;
  isLoading: boolean;
  placeholder: string;
  featuresButton?: React.ReactNode;
  onExtractText?: (file: { data: string; mimeType: string }) => Promise<string | null>;
  accept?: string;
}

// Custom types for the experimental SpeechRecognition API
interface SpeechRecognitionResult {
    isFinal: boolean;
    [index: number]: { transcript: string };
}
interface SpeechRecognitionEvent {
    resultIndex: number;
    results: SpeechRecognitionResult[];
}
interface SpeechRecognitionErrorEvent {
    error: string;
}
interface ISpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: () => void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onend: () => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    start: () => void;
    stop: () => void;
}


// Let TypeScript know about the experimental SpeechRecognition API
declare global {
    interface Window {
      SpeechRecognition: new () => ISpeechRecognition;
      webkitSpeechRecognition: new () => ISpeechRecognition;
    }
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, placeholder, featuresButton, onExtractText, accept }) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isExtractingText, setIsExtractingText] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [text]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'vi-VN';

    recognition.onstart = () => {
        setIsListening(true);
    };
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript) {
          setText(prev => prev + (prev ? ' ' : '') + finalTranscript);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        alert('Không thể truy cập microphone. Vui lòng cho phép quyền truy cập microphone trong cài đặt trình duyệt để sử dụng tính năng này.');
      } else if (event.error === 'no-speech') {
        // Ignore no-speech error, just stop listening
      } else {
        // alert('Lỗi nhận dạng giọng nói: ' + event.error);
      }
    };

    recognitionRef.current = recognition;
  }, []);


  const fileToBase64 = (file: File): Promise<{ data: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64String = result.split(',')[1];
        resolve({ data: base64String, mimeType: file.type });
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleRemoveFile = (indexToRemove: number) => {
    const urlToRemove = imagePreviewUrls[indexToRemove];
    if (urlToRemove && !urlToRemove.startsWith('data:')) {
        URL.revokeObjectURL(urlToRemove);
    }
    setFiles(prev => prev.filter((_, i) => i !== indexToRemove));
    setImagePreviewUrls(prev => prev.filter((_, i) => i !== indexToRemove));
    
    // Reset file input so same file can be selected again
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files) as File[];
      
      const newFiles: File[] = [];
      const newUrls: string[] = [];
      
      selectedFiles.forEach(file => {
          newFiles.push(file);
          if (file.type.startsWith('image/')) {
              newUrls.push(URL.createObjectURL(file));
          } else {
              newUrls.push('file_icon');
          }
      });

      setFiles(prev => [...prev, ...newFiles]);
      setImagePreviewUrls(prev => [...prev, ...newUrls]);
    }
    // Reset input value to allow re-selection of the same file if needed
    if (e.target) {
        e.target.value = '';
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
          recognitionRef.current?.start();
      } catch (e) {
          console.error("Failed to start recognition", e);
      }
    }
  };
  
  const handleExtractTextClick = async (index: number) => {
      if (!onExtractText) return;
      const file = files[index];
      if (!file.type.startsWith('image/')) return;
      
      setIsExtractingText(index);
      try {
          const base64 = await fileToBase64(file);
          const extractedText = await onExtractText(base64);
          if (extractedText) {
              setText(prev => (prev ? prev + '\n' : '') + extractedText);
          }
      } catch (error) {
          console.error("Extraction failed", error);
      } finally {
          setIsExtractingText(null);
      }
  };

  const handleSend = async () => {
    if ((!text.trim() && files.length === 0) || isLoading) return;

    const fileDataPromises = files.map(file => fileToBase64(file).then(res => ({
        name: file.name,
        data: res.data,
        mimeType: res.mimeType
    })));

    const processedFiles = await Promise.all(fileDataPromises);
    
    onSendMessage(text, processedFiles);
    setText('');
    setFiles([]);
    setImagePreviewUrls([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent send if user is currently composing via IME (e.g. Vietnamese Telex)
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative w-full border border-border rounded-2xl bg-input-bg shadow-sm transition-all focus-within:ring-2 focus-within:ring-brand/50 focus-within:border-brand">
      {/* File Previews */}
      {files.length > 0 && (
        <div className="flex gap-2 p-3 overflow-x-auto border-b border-border scrollbar-thin scrollbar-thumb-border">
          {files.map((file, index) => (
            <div key={index} className="relative flex-shrink-0 group w-16 h-16">
              {imagePreviewUrls[index] === 'file_icon' ? (
                  <div className="w-full h-full bg-card rounded-lg border border-border flex items-center justify-center flex-col p-1">
                      <FileIcon className="w-6 h-6 text-text-secondary mb-1" />
                      <span className="text-[9px] text-text-secondary w-full truncate text-center">{file.name.split('.').pop()}</span>
                  </div>
              ) : (
                  <div className="w-full h-full relative">
                    <img 
                        src={imagePreviewUrls[index]} 
                        alt="preview" 
                        className="w-full h-full object-cover rounded-lg border border-border" 
                    />
                    {/* OCR Scan Button */}
                    {onExtractText && (
                        <button
                            onClick={() => handleExtractTextClick(index)}
                            className="absolute bottom-0 left-0 right-0 bg-black/60 hover:bg-black/80 text-white text-[10px] font-bold py-0.5 text-center rounded-b-lg transition-colors flex items-center justify-center gap-0.5"
                            title="Trích xuất văn bản từ ảnh"
                            disabled={isExtractingText === index}
                        >
                            {isExtractingText === index ? (
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <ScanIcon className="w-3 h-3" /> Scan
                                </>
                            )}
                        </button>
                    )}
                  </div>
              )}
              <button 
                onClick={() => handleRemoveFile(index)}
                className="absolute -top-2 -right-2 bg-card text-text-primary rounded-full p-0.5 shadow-md border border-border hover:bg-red-500 hover:text-white transition-colors z-10"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        rows={1}
        className="w-full bg-transparent border-none focus:ring-0 p-4 text-base resize-none max-h-[200px] placeholder-text-secondary/70"
      />

      <div className="flex items-center justify-between p-2 pl-3">
        <div className="flex items-center gap-1 md:gap-2">
          {/* Features Button (Passed from Parent) */}
          {featuresButton}
          
          {/* File Attachment */}
          <input 
            type="file" 
            multiple 
            ref={fileInputRef}
            onChange={handleFileChange} 
            className="hidden" 
            accept={accept}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-full text-text-secondary hover:bg-sidebar transition-colors active:scale-95"
            title="Đính kèm tệp"
          >
            <AttachmentIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
            {/* Microphone */}
            {window.SpeechRecognition || window.webkitSpeechRecognition ? (
                <button 
                    onClick={toggleListening}
                    className={`p-2.5 rounded-full transition-all active:scale-95 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-text-secondary hover:bg-sidebar'}`}
                    title={isListening ? "Đang nghe..." : "Nhập bằng giọng nói"}
                >
                    <MicrophoneIcon className="w-5 h-5" />
                </button>
            ) : null}

            {/* Send Button */}
            <button
                onClick={handleSend}
                disabled={(!text.trim() && files.length === 0) || isLoading}
                className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center shadow-sm ${
                (!text.trim() && files.length === 0) || isLoading
                    ? 'bg-sidebar text-text-secondary cursor-not-allowed'
                    : 'bg-brand text-white hover:bg-brand/90 active:scale-95 shadow-brand/20'
                }`}
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <SendIcon className="w-5 h-5" />
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;