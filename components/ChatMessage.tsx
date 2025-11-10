import React, { useState, useEffect, useRef } from 'react';
import { type Message, type MindMapNode } from '../types';
import { UserIcon, AngryBotIcon, SpeakerIcon, ShareIcon, CheckIcon, BellPlusIcon, FlashcardIcon, FileIcon, DownloadIcon, MindMapIcon } from './Icons';
import { type FollowUpAction } from '../App';


// Let TypeScript know about the objects on the window
declare global {
  interface Window {
    MathJax: {
      typesetPromise: () => Promise<void>;
    };
    functionPlot: (options: any) => any;
  }
}

interface ChatMessageProps {
  message: Message;
  isLastMessage?: boolean;
  isLoading?: boolean;
  onFollowUpClick?: (originalText: string, action: FollowUpAction) => void;
  onApplySchedule?: (markdownText: string) => void;
  onOpenFlashcards?: (cards: { term: string; definition: string }[]) => void;
  onOpenMindMap?: (data: MindMapNode) => void;
}


const markdownToHTML = (markdown: string): string => {
  // This function handles the full markdown string.
  
  // Process block elements first to avoid them being wrapped in <p> tags.
  // Order matters. Tables, code blocks, lists should be parsed before paragraphs.

  let html = markdown
    // Headings
    .replace(/^###### (.*$)/gim, '<h6>$1</h6>')
    .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
    .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Fenced Code Blocks
    .replace(/```(.*?)\n([\s\S]*?)```/g, (match, lang, code) => {
        const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<pre><code class="language-${lang}">${escapedCode.trim()}</code></pre>`;
    })
    // Tables
    .replace(/^\|(.+)\|\r?\n\|( *[-:]+[-| :]*)\|\r?\n((?:\|.*\|\r?\n?)*)/gm, (match, header, separator, body) => {
      const headers = header.split('|').slice(1, -1).map(h => `<th>${h.trim()}</th>`).join('');
      const rows = body.trim().split('\n').map(rowStr => {
          const cells = rowStr.split('|').slice(1, -1).map(c => `<td>${c.trim()}</td>`).join('');
          return `<tr>${cells}</tr>`;
      }).join('');
      return `<div class="table-wrapper"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
    })
    // Blockquotes
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    // Lists (a bit tricky with regex, but this handles simple cases)
    .replace(/^\s*([*-]) (.*)/gm, '<ul><li>$2</li></ul>') // Unordered
    .replace(/^\s*(\d+)\. (.*)/gm, '<ol><li>$2</li></ol>') // Ordered
    .replace(/<\/ul>\s*<ul>/g, '') // Merge consecutive UL
    .replace(/<\/ol>\s*<ol>/g, ''); // Merge consecutive OL
  
  // Process inline elements
  html = html
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-200 dark:bg-slate-900 text-amber-600 dark:text-amber-400 px-1.5 py-1 rounded text-sm font-mono">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-brand hover:underline">$1</a>');

  // Paragraphs: wrap remaining text blocks in <p> tags.
  // A block is separated by one or more empty lines.
  html = html.split(/\n\s*\n/).map(paragraph => {
      if (!paragraph.trim()) return '';
      // Don't wrap if it's already a block element
      if (paragraph.trim().match(/^(<\/?(h[1-6]|ul|ol|li|blockquote|div|table|thead|tbody|tr|th|td|pre|code))/)) {
          return paragraph;
      }
      // For paragraphs, convert single newlines to <br>
      return `<p>${paragraph.trim().replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLastMessage = false, isLoading = false, onFollowUpClick, onApplySchedule, onOpenFlashcards, onOpenMindMap }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const isUser = message.role === 'user';
  const timeoutRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const messageId = useRef(`msg-${Math.random().toString(36).substring(2, 9)}`); // Unique ID for this message instance


  // Effect for the "typing" animation
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const shouldAnimate = message.role === 'model' && isLastMessage && isLoading;

    if (!shouldAnimate) {
      setDisplayedText(message.text);
      return;
    }

    if (displayedText.length < message.text.length) {
      const nextChar = message.text[displayedText.length];
      // Create a more natural typing rhythm
      let delay = 25 + Math.random() * 20; // Base speed: ~25-45ms per char
      if (['.', '?', '!', ',', ';', ':'].includes(nextChar)) {
        delay = 250; // Longer pause for punctuation
      } else if (nextChar === '\n') {
        delay = 150; // Pause for new lines
      }

      const typeNextChar = () => {
        setDisplayedText(message.text.substring(0, displayedText.length + 1));
      };
      timeoutRef.current = window.setTimeout(typeNextChar, delay);

    } else if (!isLoading && displayedText !== message.text) {
      // Ensure final text is set if loading finishes early
      setDisplayedText(message.text);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [message.text, displayedText, isUser, isLastMessage, isLoading]);
  
  useEffect(() => {
    return () => {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeaking]);

  useEffect(() => {
    const isStableBotMessage = message.role === 'model' && (!isLastMessage || !isLoading);
    if (contentRef.current && isStableBotMessage) {
        // Typeset MathJax
        if (window.MathJax) {
            window.MathJax.typesetPromise().catch(err => console.error('MathJax typesetting failed:', err));
        }

        // Render graphs
        const graphElements = contentRef.current.querySelectorAll('.graph-container');
        graphElements.forEach(el => {
            if (el.innerHTML) return; // Don't re-render if it already has content (e.g., an error message or a graph)
            const functionStrings = (el.getAttribute('data-functions') || '').split(';').filter(Boolean);
            if (functionStrings.length > 0 && window.functionPlot) {
                try {
                    const containerWidth = el.clientWidth || 350;
                    window.functionPlot({
                        target: `#${el.id}`,
                        width: containerWidth,
                        height: Math.min(containerWidth * 0.75, 400),
                        grid: true,
                        data: functionStrings.map(fn => ({ fn }))
                    });
                } catch (e) {
                    console.error("Function plot error:", e);
                    const error = e as Error;
                    el.innerHTML = `<p class="text-red-500 p-2">Lỗi vẽ đồ thị: ${error.message}</p>`;
                }
            }
        });
        
        const processCustomTable = (lang: string, containerClass: string) => {
            const elements = contentRef.current!.querySelectorAll(`code.language-${lang}`);
            elements.forEach(codeElement => {
                const preElement = codeElement.parentElement;
                if (!preElement || preElement.tagName !== 'PRE') return;
                
                const markdownTable = codeElement.textContent || '';
                const lines = markdownTable.trim().split('\n');
                if (lines.length < 3) return; // Not a valid table

                const headerLine = lines[0];
                const bodyLines = lines.slice(2);

                const headers = headerLine.split('|').slice(1, -1).map(h => `<th>${h.trim()}</th>`).join('');
                const rows = bodyLines.map(rowStr => {
                    const cells = rowStr.split('|').slice(1, -1).map(c => `<td>${c.trim()}</td>`).join('');
                    return `<tr>${cells}</tr>`;
                }).join('');

                const tableHtml = `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
                
                const container = document.createElement('div');
                container.className = `${containerClass} not-prose`;
                container.innerHTML = tableHtml;

                preElement.parentNode?.replaceChild(container, preElement);
            });
        };
        
        // Render Bảng Biến Thiên
        processCustomTable('bbt', 'variation-table-container');

        // Render Bảng Xét Dấu
        processCustomTable('bsd', 'sign-table-container');

        // Add Copy Code buttons
        const preElements = contentRef.current.querySelectorAll('pre');
        preElements.forEach(pre => {
            if (pre.querySelector('.copy-code-button')) return;

            const button = document.createElement('button');
            button.className = 'copy-code-button';
            button.setAttribute('aria-label', 'Sao chép mã');
            button.title = 'Sao chép mã';

            const copyIconHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;
            const checkIconHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            
            button.innerHTML = copyIconHTML;

            button.addEventListener('click', () => {
                const codeElement = pre.querySelector('code');
                if (codeElement) {
                    navigator.clipboard.writeText(codeElement.innerText).then(() => {
                        button.innerHTML = checkIconHTML;
                        button.classList.add('copied');
                        setTimeout(() => {
                            button.innerHTML = copyIconHTML;
                            button.classList.remove('copied');
                        }, 2000);
                    }).catch(err => {
                        console.error('Không thể sao chép mã:', err);
                        alert('Lỗi: Không thể sao chép vào clipboard.');
                    });
                }
            });

            pre.appendChild(button);
        });
    }
  }, [displayedText, isLastMessage, isLoading, message.role]);

  const handleToggleSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const textToSpeak = message.text.replace(/\$|\\\(|\\\)|\\\[|\\\]/g, '');
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'vi-VN';
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  const handleShare = async () => {
    const textToShare = message.text;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'KL AI Chat Message',
          text: textToShare,
        });
      } catch (error) {
        console.error('Lỗi khi chia sẻ:', error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(textToShare);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (error) {
        console.error('Không thể sao chép văn bản:', error);
      }
    }
  };

  const handleDownload = (fileData: Required<Message>['fileToDownload']) => {
    const blob = new Blob([fileData.content], { type: fileData.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileData.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderContent = (text: string) => {
    if (!text) return null;

    const mathBlocks: string[] = [];
    const mathPlaceholder = '___MATHJAX_PLACEHOLDER___';

    let textWithPlaceholders = text.replace(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g, (match) => {
        const index = mathBlocks.length;
        mathBlocks.push(match);
        return `${mathPlaceholder}${index}${mathPlaceholder}`;
    });

    textWithPlaceholders = textWithPlaceholders.replace(/```graph\n([\s\S]*?)\n```/g, (match, content) => {
        const index = Math.random().toString(36).substring(7); // Use random index for safety
        const functions = content.trim().split('\n').map((fn:string) => fn.replace(/f\(x\)\s*=\s*|y\s*=\s*/, '').trim()).join(';');
        return `<div id="graph-${messageId.current}-${index}" class="graph-container my-4" data-functions="${functions}"></div>`;
    });
    
    let html = markdownToHTML(textWithPlaceholders);
    
    mathBlocks.forEach((block, index) => {
        const searchString = `${mathPlaceholder}${index}${mathPlaceholder}`;
        html = html.replace(searchString, block);
    });
    
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const textToDisplay = isUser ? message.text : displayedText;
  const isTyping = isLastMessage && isLoading && message.role === 'model' && message.text.length > 0;

  const bubbleClasses = isUser 
    ? 'bg-gradient-to-br from-brand to-blue-700 text-user-bubble-text' 
    : 'bg-model-bubble-bg text-model-bubble-text';
  const alignmentClasses = isUser ? 'justify-end' : 'justify-start';
  const IconComponent = isUser ? UserIcon : AngryBotIcon;
  const iconClasses = isUser ? 'text-brand' : 'text-amber-400';
  const showFollowUpActions = !isUser && (!isLastMessage || !isLoading) && message.text && onFollowUpClick && !message.mindMapData;
  const showApplyScheduleButton = !isUser && (!isLastMessage || !isLoading) && message.text.includes('|') && message.text.includes('---') && onApplySchedule;
  const showOpenFlashcardsButton = !isUser && message.flashcards && message.flashcards.length > 0 && onOpenFlashcards;
  const showDownloadButton = !isUser && message.fileToDownload && (!isLastMessage || !isLoading);
  const showOpenMindMapButton = !isUser && message.mindMapData && onOpenMindMap && (!isLastMessage || !isLoading);

  if (!textToDisplay && message.role === 'model' && !isTyping && !message.file && !message.mindMapData) {
    return null;
  }
  
  return (
    <div className="animate-slide-in-up">
      <div className={`flex items-start gap-3 w-full max-w-full ${alignmentClasses}`}>
        {!isUser && <IconComponent className={`w-8 h-8 flex-shrink-0 mt-1 ${iconClasses}`} />}
        <div 
          ref={contentRef}
          className={`px-4 py-3 rounded-2xl max-w-xl lg:max-w-3xl prose prose-sm dark:prose-invert break-words shadow-md ${bubbleClasses}`}
        >
          {message.file && (
            <div className="mb-2 not-prose">
              {message.file.mimeType.startsWith('image/') ? (
                <img src={message.file.dataUrl} alt={message.file.name} className="max-w-xs max-h-64 rounded-lg" />
              ) : (
                <a
                  href={message.file.dataUrl}
                  download={message.file.name}
                  className="flex items-center gap-3 p-3 bg-card/50 dark:bg-card/20 rounded-lg hover:bg-card/80 dark:hover:bg-card/40 transition-colors border border-border"
                  title={`Tải xuống ${message.file.name}`}
                >
                  <FileIcon className="w-6 h-6 text-text-secondary flex-shrink-0" />
                  <span className="text-sm font-medium text-text-primary truncate">{message.file.name}</span>
                </a>
              )}
            </div>
          )}
          {renderContent(textToDisplay)}
          {isTyping && <span className="inline-block w-2 h-4 bg-gray-400 dark:bg-gray-500 animate-pulse ml-1 align-bottom"></span>}
        </div>
        {isUser && <IconComponent className={`w-8 h-8 flex-shrink-0 mt-1 ${iconClasses}`} />}
      </div>
      
      <div className={`flex items-center flex-wrap gap-2 mt-2 ${isUser ? 'justify-end' : 'pl-11'}`}>
        {!isUser && message.text && (!isLastMessage || !isLoading) && (
            <>
                <button 
                onClick={handleToggleSpeech} 
                className="p-1.5 bg-card-hover/60 hover:bg-card-hover rounded-full transition-colors"
                aria-label={isSpeaking ? "Dừng đọc" : "Đọc to"}
                title={isSpeaking ? "Dừng đọc" : "Đọc to"}
                >
                <SpeakerIcon className={`w-4 h-4 ${isSpeaking ? 'text-brand' : 'text-text-secondary'}`} />
                </button>
                <button
                    onClick={handleShare}
                    className="p-1.5 bg-card-hover/60 hover:bg-card-hover rounded-full transition-colors"
                    aria-label={isCopied ? "Đã sao chép!" : "Chia sẻ"}
                    title={isCopied ? "Đã sao chép!" : "Chia sẻ"}
                >
                    {isCopied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <ShareIcon className="w-4 h-4 text-text-secondary" />}
                </button>
            </>
        )}

        {showDownloadButton && (
          <button
            onClick={() => handleDownload(message.fileToDownload!)}
            className="bg-brand/10 hover:bg-brand/20 text-brand text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 font-semibold"
          >
            <DownloadIcon className="w-4 h-4" /> Tải xuống {message.fileToDownload!.name}
          </button>
        )}

        {showOpenMindMapButton && (
          <button
            onClick={() => onOpenMindMap(message.mindMapData!)}
            className="bg-brand/10 hover:bg-brand/20 text-brand text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 font-semibold"
          >
            <MindMapIcon className="w-4 h-4" /> Mở sơ đồ tư duy
          </button>
        )}

        {showOpenFlashcardsButton && onOpenFlashcards && (
          <button
            onClick={() => onOpenFlashcards(message.flashcards!)}
            className="bg-brand/10 hover:bg-brand/20 text-brand text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 font-semibold"
          >
            <FlashcardIcon className="w-4 h-4" /> Mở lại bộ thẻ
          </button>
        )}

        {showApplyScheduleButton && onApplySchedule && (
          <button
            onClick={() => onApplySchedule(message.text)}
            className="bg-brand/10 hover:bg-brand/20 text-brand text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 font-semibold"
          >
            <BellPlusIcon className="w-4 h-4" /> Áp dụng lịch & Bật thông báo
          </button>
        )}

        {showFollowUpActions && (
          <>
            <button 
              onClick={() => onFollowUpClick(message.text, 'explain')}
              className="bg-card-hover/60 hover:bg-card-hover text-text-secondary text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
            >
              🔁 Giải thích thêm
            </button>
            <button 
              onClick={() => onFollowUpClick(message.text, 'example')}
              className="bg-card-hover/60 hover:bg-card-hover text-text-secondary text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
            >
              ✍️ Tạo ví dụ tương tự
            </button>
            <button 
              onClick={() => onFollowUpClick(message.text, 'summarize')}
              className="bg-card-hover/60 hover:bg-card-hover text-text-secondary text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
            >
              📈 Tóm tắt ngắn lại
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;