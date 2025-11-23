
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { type Message, type MindMapNode, type FollowUpAction, type Flashcard } from '../types';
import { UserIcon, AngryBotIcon, SpeakerIcon, ShareIcon, CheckIcon, BellPlusIcon, FileIcon, DownloadIcon, MindMapIcon, FlashcardIcon, ThumbUpIcon, ThumbDownIcon, HelpCircleIcon, RegenerateIcon, ChevronUpIcon, ExplainIcon, ExampleIcon, SummarizeIcon, ChevronDownIcon, CalendarPlusIcon, GlobeIcon } from './Icons';
import DataChart from './DataChart';


// Let TypeScript know about the objects on the window
declare global {
  interface Window {
    MathJax: {
      typesetPromise: (elements?: HTMLElement[]) => Promise<void>;
    };
    functionPlot: (options: any) => any;
    hljs: any;
  }
}

interface ChatMessageProps {
  message: Message;
  isLastMessage?: boolean;
  isLoading?: boolean;
  onFollowUpClick?: (originalText: string, action: FollowUpAction) => void;
  onApplySchedule?: (markdownText: string) => void;
  onOpenMindMap?: (data: MindMapNode) => void;
  onOpenFlashcards?: (data: Flashcard[]) => void;
  onAskSelection?: (selectedText: string) => void;
  onRegenerate?: () => void;
  onPublish?: (message: Message) => void;
  userAvatar?: string;
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

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLastMessage = false, isLoading = false, onFollowUpClick, onApplySchedule, onOpenMindMap, onOpenFlashcards, onAskSelection, onRegenerate, onPublish, userAvatar }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);
  const [selectionPopover, setSelectionPopover] = useState<{ visible: boolean; x: number; y: number; } | null>(null);
  const isUser = message.role === 'user';
  const timeoutRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const selectedTextRef = useRef('');
  const messageId = useRef(`msg-${Math.random().toString(36).substring(2, 9)}`); // Unique ID for this message instance


  // Effect 1: Typing Animation
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

  const textToDisplay = isUser ? message.text : displayedText;

  // Memoize the HTML content generation to prevent unnecessary DOM updates
  const htmlContent = useMemo(() => {
    if (!textToDisplay) return '';

    const mathBlocks: string[] = [];
    const mathPlaceholder = '___MATHJAX_PLACEHOLDER___';

    let textWithPlaceholders = textToDisplay.replace(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g, (match) => {
        const index = mathBlocks.length;
        mathBlocks.push(match);
        return `${mathPlaceholder}${index}${mathPlaceholder}`;
    });

    // Use a deterministic counter for graphs within this specific render cycle of the message
    let graphCounter = 0;

    textWithPlaceholders = textWithPlaceholders.replace(/```graph\n([\s\S]*?)\n```/g, (match, content) => {
        // Use messageId + counter to ensure stability across re-renders
        const uniqueGraphId = `${messageId.current}-${graphCounter++}`;
        
        const functionData = content.trim().split('\n').map(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return null;

            // Regex to find "from ... to ..." or "từ ... đến ..."
            const rangeRegex = /(?:from|từ)\s+([-\d\w\s.πpi*+/()]+)\s+(?:to|đến)\s+([-\d\w\s.πpi*+/()]+)/iu;
            const rangeMatch = trimmedLine.match(rangeRegex);

            let fnString = trimmedLine;
            let range: [number, number] | undefined = undefined;

            if (rangeMatch) {
                fnString = trimmedLine.substring(0, rangeMatch.index).trim();
                
                const parseRangeValue = (val: string): number => {
                    const cleanedVal = val.trim().toLowerCase().replace(/π/g, 'pi');
                    try {
                        let expression = cleanedVal.replace(/\bpi\b/g, `(${Math.PI})`);
                        // Add support for e
                        expression = expression.replace(/\be\b/g, `(${Math.E})`);

                        // Allow only a safe subset of characters
                        if (/^[-()\d\s*+./]+$/.test(expression)) {
                            const result = new Function(`return ${expression}`)();
                            if (typeof result === 'number' && isFinite(result)) {
                                return result;
                            }
                        }
                    } catch (e) { /* ignore parse error */ }
                    // Fallback for simple numbers
                    return parseFloat(cleanedVal);
                };

                const start = parseRangeValue(rangeMatch[1]);
                const end = parseRangeValue(rangeMatch[2]);
                
                if (!isNaN(start) && !isNaN(end)) {
                    range = [start, end];
                }
            }

            let finalFn: string | null = null;
            const definitionMatch = fnString.match(/^(?:f\(x\)|y)\s*=\s*(.*)/i);
            if (definitionMatch && definitionMatch[1]) {
                finalFn = definitionMatch[1].trim();
            } else {
                // Heuristic to check if it's a plain expression
                const nonMathChars = fnString.replace(/[xy\d\s.()+\-*/^]|sin|cos|tan|log|ln|sqrt|abs|pi|e/gi, '');
                if (nonMathChars.length === 0) {
                    finalFn = fnString;
                }
            }

            if (finalFn) {
                const dataObject: { fn: string, range?: [number, number] } = { fn: finalFn };
                if (range) {
                    dataObject.range = range;
                }
                return dataObject;
            }
            return null;
        }).filter((item): item is { fn: string, range?: [number, number] } => item !== null);
        
        const encodedData = JSON.stringify(functionData).replace(/'/g, '&apos;');
        return `<div id="graph-${uniqueGraphId}" class="graph-container my-4" data-functions='${encodedData}'></div>`;
    });
    
    let html = markdownToHTML(textWithPlaceholders);
    
    mathBlocks.forEach((block, index) => {
        const searchString = `${mathPlaceholder}${index}${mathPlaceholder}`;
        html = html.replace(searchString, block);
    });
    
    return html;
  }, [textToDisplay]);


  // Effect 2: DOM Manipulations (Graphs, MathJax, Tables)
  useEffect(() => {
    if (contentRef.current && htmlContent) {
        
        // 1. Render graphs
        const graphElements = contentRef.current.querySelectorAll('.graph-container');
        graphElements.forEach(el => {
            el.innerHTML = ''; 
            const functionDataString = el.getAttribute('data-functions');
            if (functionDataString) {
                try {
                    const functionData = JSON.parse(functionDataString);
                    if (Array.isArray(functionData) && functionData.length > 0 && window.functionPlot) {
                        const containerWidth = el.clientWidth || 350;
                        const dataWithScope = functionData.map((d: any) => ({
                            ...d,
                            scope: { ...d.scope, e: Math.E }
                        }));

                        window.functionPlot({
                            target: `#${el.id}`,
                            width: containerWidth,
                            height: Math.min(containerWidth * 0.75, 400),
                            grid: true,
                            data: dataWithScope
                        });
                    }
                } catch (e) {
                    const error = e as Error;
                    el.innerHTML = `<p class="text-red-500 p-2">Lỗi vẽ đồ thị: ${error.message}</p>`;
                }
            }
        });
        
        // 2. Process Custom Tables (BBT, BSD)
        const processCustomTable = (lang: string, containerClass: string) => {
            const elements = contentRef.current!.querySelectorAll(`code.language-${lang}`);
            elements.forEach(codeElement => {
                const preElement = codeElement.parentElement;
                if (!preElement || preElement.tagName !== 'PRE') return;
                const markdownTable = codeElement.textContent || '';
                const lines = markdownTable.trim().split('\n');
                if (lines.length < 3) return; 

                const headerLine = lines[0];
                const bodyLines = lines.slice(2);
                const parseCell = (text: string) => {
                    let t = text.trim();
                    t = t.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
                    t = t.replace(/\*(.*?)\*/g, '<i>$1</i>');
                    return t;
                };

                const headers = headerLine.split('|').slice(1, -1).map(h => `<th>${parseCell(h)}</th>`).join('');
                const rows = bodyLines.map(rowStr => {
                    const cells = rowStr.split('|').slice(1, -1).map(c => `<td>${parseCell(c)}</td>`).join('');
                    return `<tr>${cells}</tr>`;
                }).join('');

                const tableHtml = `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
                const container = document.createElement('div');
                container.className = `${containerClass} not-prose`;
                container.innerHTML = tableHtml;
                preElement.parentNode?.replaceChild(container, preElement);
            });
        };
        
        processCustomTable('bbt', 'variation-table-container');
        processCustomTable('bsd', 'sign-table-container');

        // 3. Auto-detect standard tables
        const standardTables = contentRef.current.querySelectorAll('.table-wrapper table');
        standardTables.forEach(table => {
             const firstHeader = table.querySelector('thead th:first-child');
             const secondRowHeader = table.querySelector('tbody tr:first-child td:first-child');
             if (firstHeader && (firstHeader.textContent?.trim() === 'x') && 
                 secondRowHeader && (['y\'', "f'(x)", 'y'].includes(secondRowHeader.textContent?.trim() || ''))) {
                 table.classList.add('variation-table');
                  const wrapper = table.closest('.table-wrapper');
                  if (wrapper) {
                      wrapper.classList.add('variation-table-container');
                      wrapper.classList.remove('table-wrapper'); 
                  }
             }
        });

        // 4. Typeset MathJax
        if (window.MathJax && contentRef.current) {
            window.MathJax.typesetPromise([contentRef.current]).catch(err => console.error('MathJax typesetting failed:', err));
        }

        // 5. Code Block Enhancements
        const preElements = contentRef.current.querySelectorAll('pre');
        const MAX_CODE_HEIGHT = 300;

        preElements.forEach(pre => {
            if (pre.parentElement?.classList.contains('code-block-wrapper')) return;
            const codeElement = pre.querySelector('code');
            if (codeElement && window.hljs) {
                try {
                    window.hljs.highlightElement(codeElement);
                } catch (e) {}
            }
            
            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper not-prose';
            pre.parentNode?.replaceChild(wrapper, pre);
            wrapper.appendChild(pre);
            
            if (!pre.querySelector('.copy-code-button')) {
                const button = document.createElement('button');
                button.className = 'copy-code-button';
                button.setAttribute('aria-label', 'Sao chép mã');
                button.title = 'Sao chép mã';
                button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;
                
                button.addEventListener('click', () => {
                    if (codeElement) {
                        navigator.clipboard.writeText(codeElement.innerText).then(() => {
                            button.classList.add('copied');
                            setTimeout(() => button.classList.remove('copied'), 2000);
                        });
                    }
                });
                pre.appendChild(button);
            }

            setTimeout(() => {
                const needsCollapsing = pre.scrollHeight > MAX_CODE_HEIGHT;
                if (needsCollapsing && !wrapper.querySelector('.show-more-button')) {
                    pre.classList.add('is-collapsible');
                    pre.style.maxHeight = `${MAX_CODE_HEIGHT}px`;
                    const showMoreButton = document.createElement('button');
                    showMoreButton.className = 'show-more-button';
                    showMoreButton.innerHTML = `<span>Show more</span>`;
                    
                    showMoreButton.addEventListener('click', () => {
                        const isExpanded = pre.classList.toggle('is-expanded');
                        if (isExpanded) {
                            pre.style.maxHeight = `${pre.scrollHeight}px`;
                            showMoreButton.querySelector('span')!.textContent = 'Show less';
                        } else {
                            pre.style.maxHeight = `${pre.scrollHeight}px`;
                            requestAnimationFrame(() => {
                                pre.style.maxHeight = `${MAX_CODE_HEIGHT}px`;
                            });
                            showMoreButton.querySelector('span')!.textContent = 'Show more';
                        }
                    });
                    wrapper.appendChild(showMoreButton);
                }
            }, 50);
        });
    }
  }, [htmlContent, isLoading]); 

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
        if (isUser || !contentRef.current || !onAskSelection) return;
        if ((e.target as HTMLElement).closest('.selection-popover')) return;
        
        setTimeout(() => {
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
                if (contentRef.current?.contains(selection.anchorNode)) {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    selectedTextRef.current = selection.toString();
                    setSelectionPopover({
                        visible: true,
                        x: rect.left + rect.width / 2,
                        y: rect.top + window.scrollY - 10,
                    });
                } else {
                    setSelectionPopover(null);
                }
            } else {
                setSelectionPopover(null);
            }
        }, 10);
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [isUser, onAskSelection]);

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
        await navigator.share({ title: 'KL AI Chat Message', text: textToShare });
      } catch (error) {}
    } else {
      try {
        await navigator.clipboard.writeText(textToShare);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (error) {}
    }
  };

  const handleDownload = (fileData: { name: string; content: string; mimeType: string }) => {
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
  
  const handleAddToCalendar = () => {
      if (!message.scheduleData) return;
      const { title, startTime, endTime, details, location } = message.scheduleData;
      const toISOStringCompact = (dateStr: string) => {
          try {
              const d = new Date(dateStr);
              return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
          } catch (e) { return ''; }
      };
      const start = toISOStringCompact(startTime);
      const end = toISOStringCompact(endTime);
      const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(details)}${location ? `&location=${encodeURIComponent(location)}` : ''}`;
      window.open(googleCalendarUrl, '_blank');
  };

  const handleFeedback = (type: 'like' | 'dislike') => {
    setFeedback(prev => (prev === type ? null : type));
  };

  const isTyping = isLastMessage && isLoading && message.role === 'model' && message.text.length > 0;

  const bubbleClasses = isUser 
    ? 'bg-user-bubble-bg text-user-bubble-text' 
    : message.isError
    ? 'bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/30 prose-p:text-current prose-strong:text-current'
    : 'bg-model-bubble-bg text-model-bubble-text';
  const alignmentClasses = isUser ? 'justify-end' : 'justify-start';
  const IconComponent = isUser ? UserIcon : AngryBotIcon;
  const iconClasses = isUser ? 'text-brand' : 'text-amber-400';
  const showFollowUpActions = !isUser && (!isLastMessage || !isLoading) && message.text && onFollowUpClick && !message.mindMapData && !message.isError;
  const showApplyScheduleButton = !isUser && (!isLastMessage || !isLoading) && message.mode === 'create_schedule' && onApplySchedule;
  const showDownloadButton = !isUser && message.fileToDownload && (!isLastMessage || !isLoading);
  const showOpenMindMapButton = !isUser && message.mindMapData && onOpenMindMap && (!isLastMessage || !isLoading);
  const showOpenFlashcardsButton = !isUser && message.flashcards && onOpenFlashcards && (!isLastMessage || !isLoading);
  const showAddToCalendar = !isUser && message.scheduleData && (!isLastMessage || !isLoading);

  if (!textToDisplay && message.role === 'model' && !isTyping && (!message.files || message.files.length === 0) && !message.mindMapData && !message.chartConfig && !message.flashcards) {
    return null;
  }
  
  return (
    <>
      {selectionPopover?.visible && !isUser && createPortal(
          <div
              className="selection-popover fixed bg-card border border-border shadow-lg rounded-full flex items-center gap-2 px-3 py-1.5 animate-message-pop-in"
              style={{
                  top: `${selectionPopover.y}px`,
                  left: `${selectionPopover.x}px`,
                  transform: 'translate(-50%, -100%)',
                  zIndex: 100,
                  animationDuration: '0.15s'
              }}
              onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
              }}
          >
              <button
                  onClick={(e) => {
                      e.stopPropagation(); 
                      if (onAskSelection) {
                          onAskSelection(selectedTextRef.current);
                      }
                      setSelectionPopover(null);
                  }}
                  className="flex items-center gap-1.5 text-sm font-medium text-brand hover:opacity-80 transition-opacity"
              >
                  <HelpCircleIcon className="w-4 h-4" />
                  <span>Hỏi KL AI</span>
              </button>
          </div>,
          document.body
      )}
      <div className="animate-message-pop-in origin-bottom-left">
        <div className={`flex items-start gap-3 w-full max-w-full ${alignmentClasses}`}>
          {!isUser && <IconComponent className={`w-8 h-8 flex-shrink-0 mt-1 ${iconClasses}`} />}
          <div 
            ref={contentRef}
            className={`px-4 py-3 rounded-2xl max-w-xl lg:max-w-3xl prose prose-sm dark:prose-invert break-words shadow-sm ${bubbleClasses}`}
          >
            {message.files && message.files.length > 0 && (
              <div className={`mb-2 not-prose grid gap-2 ${message.files.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {message.files.map((file, index) => (
                  file.mimeType.startsWith('image/') ? (
                      <img key={index} src={file.dataUrl} alt={file.name} className="max-w-full max-h-64 rounded-lg object-contain" />
                  ) : (
                      <a
                      key={index}
                      href={file.dataUrl}
                      download={file.name}
                      className="flex items-center gap-3 p-3 bg-card/50 dark:bg-card/20 rounded-lg hover:bg-card/80 dark:hover:bg-card/40 transition-colors border border-border"
                      title={`Tải xuống ${file.name}`}
                      >
                      <FileIcon className="w-6 h-6 text-text-secondary flex-shrink-0" />
                      <span className="text-sm font-medium text-text-primary truncate">{file.name}</span>
                      </a>
                  )
                ))}
              </div>
            )}
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
            
            {!isUser && message.chartConfig && (
                <div className="mt-4 not-prose">
                    <DataChart config={message.chartConfig} />
                </div>
            )}

            {isTyping && <span className="inline-block w-2 h-4 bg-gray-400 dark:bg-gray-500 animate-pulse ml-1 align-bottom"></span>}
          </div>
          
          {isUser && (userAvatar ? (
             <div className="w-8 h-8 flex-shrink-0 mt-1 rounded-full bg-card-hover flex items-center justify-center overflow-hidden border border-border">
                  {userAvatar.startsWith('data:') ? (
                       <img src={userAvatar} alt="User" className="w-full h-full object-cover" />
                  ) : (
                      <span className="text-2xl">{userAvatar}</span>
                  )}
             </div>
          ) : (
            <IconComponent className={`w-8 h-8 flex-shrink-0 mt-1 ${iconClasses}`} />
          ))}
        </div>
        
        <div className={`flex items-center flex-wrap gap-2 mt-2 ${isUser ? 'justify-end' : 'pl-11'}`}>
          {!message.isError && message.text && (!isLastMessage || !isLoading) && (
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
                  {!isUser && (
                      <>
                        <button onClick={() => handleFeedback('like')} className="p-1.5 bg-card-hover/60 hover:bg-card-hover rounded-full transition-colors" title="Hài lòng">
                            <ThumbUpIcon className={`w-4 h-4 transition-colors ${feedback === 'like' ? 'text-brand' : 'text-text-secondary'}`} />
                        </button>
                        <button onClick={() => handleFeedback('dislike')} className="p-1.5 bg-card-hover/60 hover:bg-card-hover rounded-full transition-colors" title="Không hài lòng">
                            <ThumbDownIcon className={`w-4 h-4 transition-colors ${feedback === 'dislike' ? 'text-red-500' : 'text-text-secondary'}`} />
                        </button>
                      </>
                  )}
                  {onPublish && (
                      <button onClick={() => onPublish(message)} className="p-1.5 bg-card-hover/60 hover:bg-card-hover rounded-full transition-colors text-purple-500" title="Chia sẻ lên Hub">
                          <GlobeIcon className="w-4 h-4" />
                      </button>
                  )}
                  {isLastMessage && onRegenerate && !isUser && (
                    <button onClick={onRegenerate} className="p-1.5 bg-card-hover/60 hover:bg-card-hover rounded-full transition-colors" title="Tạo lại phản hồi">
                        <RegenerateIcon className="w-4 h-4 text-text-secondary"/>
                    </button>
                  )}
                  <div className="w-[1px] h-4 bg-border mx-1"></div>
              </>
          )}
          
          {showAddToCalendar && (
            <button
                onClick={handleAddToCalendar}
                className="bg-green-500/10 hover:bg-green-500/20 text-green-600 text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 font-semibold"
            >
                <CalendarPlusIcon className="w-4 h-4" /> Thêm vào Google Calendar
            </button>
          )}

          {showDownloadButton && message.fileToDownload && message.fileToDownload.map((file, idx) => (
            <button
              key={idx}
              onClick={() => handleDownload(file)}
              className="bg-brand/10 hover:bg-brand/20 text-brand text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 font-semibold"
            >
              <DownloadIcon className="w-4 h-4" /> Tải xuống {file.name}
            </button>
          ))}

          {showOpenMindMapButton && (
            <button
              onClick={() => onOpenMindMap(message.mindMapData!)}
              className="bg-brand/10 hover:bg-brand/20 text-brand text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 font-semibold"
            >
              <MindMapIcon className="w-4 h-4" /> Mở sơ đồ tư duy
            </button>
          )}

          {showOpenFlashcardsButton && (
            <button
              onClick={() => onOpenFlashcards(message.flashcards!)}
              className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-500 text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 font-semibold"
            >
              <FlashcardIcon className="w-4 h-4" /> Mở bộ Flashcard ({message.flashcards!.length} thẻ)
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
                    className="bg-brand/10 hover:bg-brand/20 text-brand text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 font-semibold"
                >
                    <ExplainIcon className="w-4 h-4" /> Giải thích thêm
                </button>
                <button
                    onClick={() => onFollowUpClick(message.text, 'example')}
                    className="bg-brand/10 hover:bg-brand/20 text-brand text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 font-semibold"
                >
                    <ExampleIcon className="w-4 h-4" /> Cho ví dụ
                </button>
                <button
                    onClick={() => onFollowUpClick(message.text, 'summarize')}
                    className="bg-brand/10 hover:bg-brand/20 text-brand text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 font-semibold"
                >
                    <SummarizeIcon className="w-4 h-4" /> Tóm tắt
                </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ChatMessage;
