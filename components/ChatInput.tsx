


import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, AttachmentIcon, XIcon, MicrophoneIcon, FileIcon } from './Icons';

interface ChatInputProps {
  onSendMessage: (text: string, files: { name: string; data: string; mimeType: string }[]) => void;
  isLoading: boolean;
  placeholder: string;
  featuresButton?: React.ReactNode;
}

// Let TypeScript know about the experimental SpeechRecognition API
declare global {
    interface Window {
      SpeechRecognition: any;
      webkitSpeechRecognition: any;
    }
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, placeholder, featuresButton }) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'vi-VN';

    recognition.onstart = () => {
        setIsListening(true);
    };
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setText(prevText => (prevText ? prevText + ' ' : '') + transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);


  const fileToBase64 = (file: File): Promise<{ data: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve({ data: base64String, mimeType: file.type });
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleRemoveFile = (indexToRemove: number) => {
    const urlToRemove = imagePreviewUrls[indexToRemove];
    if (urlToRemove && urlToRemove !== 'file_icon') {
        URL.revokeObjectURL(urlToRemove);
    }
    const newFiles = files.filter((_, index) => index !== indexToRemove);
    const newUrls = imagePreviewUrls.filter((_, index) => index !== indexToRemove);
    setFiles(newFiles);
    setImagePreviewUrls(newUrls);
    if (newFiles.length === 0 && fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };


  const submitMessage = async () => {
    if ((text.trim() || files.length > 0) && !isLoading) {
      const filePayloads = await Promise.all(
        files.map(async (file) => {
          const { data, mimeType } = await fileToBase64(file);
          return { name: file.name, data, mimeType };
        })
      );
      onSendMessage(text, filePayloads);
      setText('');
      // Clear all files
      imagePreviewUrls.forEach(url => {
        if (url !== 'file_icon') URL.revokeObjectURL(url);
      });
      setFiles([]);
      setImagePreviewUrls([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
        const newFiles = Array.from(selectedFiles);
        const newUrls = newFiles.map(file => file.type.startsWith('image/') ? URL.createObjectURL(file) : 'file_icon');
        
        setFiles(prev => [...prev, ...newFiles]);
        setImagePreviewUrls(prev => [...prev, ...newUrls]);
    }
  };

  const handleListenToggle = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
            const file = items[i].getAsFile();
            // FIX: Use `instanceof Blob` as a type guard. `getAsFile()` can return `null`,
            // and this ensures `file` is a valid Blob object before its properties are accessed.
            if (file instanceof Blob) {
                const extension = file.type.split('/')[1] || 'png';
                const imageFile = new File([file], `pasted-image-${Date.now()}-${i}.${extension}`, { type: file.type });
                pastedFiles.push(imageFile);
            }
        }
    }
    
    if (pastedFiles.length > 0) {
        event.preventDefault();
        const newImageUrls = pastedFiles.map(file => URL.createObjectURL(file));
        setFiles(prev => [...prev, ...pastedFiles]);
        setImagePreviewUrls(prev => [...prev, ...newImageUrls]);
        event.currentTarget.focus();
    }
  };


  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {files.length > 0 && (
        <div className="w-full p-2 bg-input-bg rounded-lg border border-border flex flex-wrap gap-3">
            {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="relative w-24 h-24">
                    {imagePreviewUrls[index] !== 'file_icon' ? (
                        <img src={imagePreviewUrls[index]} alt="Preview" className="w-full h-full object-cover rounded" />
                    ) : (
                        <div className="w-full h-full bg-card rounded flex flex-col items-center justify-center p-1 text-center">
                            <FileIcon className="w-8 h-8 text-text-secondary" />
                            <span className="text-xs text-text-secondary mt-1 w-full truncate" title={file.name}>{file.name}</span>
                        </div>
                    )}
                    <button 
                        type="button" 
                        onClick={() => handleRemoveFile(index)}
                        className="absolute -top-1.5 -right-1.5 bg-card text-text-primary rounded-full p-0.5 hover:bg-card-hover border border-border"
                        aria-label="Remove file"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        {featuresButton}
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,application/pdf,.doc,.docx,text/plain"
            className="hidden"
            id="file-upload"
            multiple
        />
        <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="p-3 bg-card-hover rounded-full hover:bg-border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-brand disabled:opacity-50 transition-colors"
            aria-label="Đính kèm tệp"
        >
            <AttachmentIcon className="w-6 h-6 text-text-secondary" />
        </button>
        <button
            type="button"
            onClick={handleListenToggle}
            disabled={isLoading}
            className={`p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-brand disabled:opacity-50 transition-colors ${
                isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-card-hover hover:bg-border text-text-secondary'
            }`}
            aria-label={isListening ? "Dừng ghi âm" : "Ghi âm giọng nói"}
        >
            <MicrophoneIcon className="w-6 h-6" />
        </button>
        <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-input-bg border border-border rounded-lg p-3 text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-brand focus:outline-none resize-none transition-all duration-200 disabled:opacity-50"
            style={{ maxHeight: '150px' }}
        />
        <button
            type="submit"
            disabled={isLoading || (!text.trim() && files.length === 0)}
            className="bg-brand text-white p-3 rounded-full transform hover:opacity-90 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-brand disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200"
            aria-label="Gửi tin nhắn"
        >
            <SendIcon className="w-6 h-6" />
        </button>
      </div>
    </form>
  );
};

export default ChatInput;