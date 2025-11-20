
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { type TranscriptItem } from '../types';
import { 
    MicrophoneIcon, 
    StopCircleIcon, 
    SparklesIcon, 
    SendIcon, 
    ChevronDownIcon, 
    WhatsappIcon,
    ChatBubbleIcon,
    CodeBracketIcon,
    ShieldExclamationIcon,
    CloudIcon,
    ServerIcon,
    LockClosedIcon,
    DevicePhoneMobileIcon,
    ArrowDownTrayIcon,
    DocumentTextIcon,
    DocumentIcon,
    GlobeAltIcon
} from './icons';
import LoadingSpinner from './LoadingSpinner';

type AIMode = 'chat' | 'code' | 'security' | 'cloud';

const MODE_CONFIG = {
    chat: {
        title: "Chat",
        icon: ChatBubbleIcon,
        systemInstruction: "You are Red AI, a friendly and helpful AI assistant developed by GM Ripon. Always introduce yourself as Red AI. Be concise and conversational."
    },
    code: {
        title: "Code Helper",
        icon: CodeBracketIcon,
        systemInstruction: "You are an expert software developer and coding assistant named Red AI, developed by GM Ripon. Always introduce yourself as Red AI. Provide clear, efficient, and well-explained code. You can handle requests for any programming language, framework, or technology."
    },
    security: {
        title: "Cybersecurity",
        icon: ShieldExclamationIcon,
        systemInstruction: "You are a specialized cybersecurity expert named Red AI, developed by GM Ripon. Always introduce yourself as Red AI. You provide knowledge on ethical hacking, system security, and tools like Kali Linux, NetHunter, and NH Pro. Your primary goal is to educate on cybersecurity concepts and provide code for security purposes, always emphasizing ethical use. You can draw knowledge from authoritative sources like the official Kali Linux documentation."
    },
    cloud: {
        title: "Cloud Ops",
        icon: CloudIcon,
        systemInstruction: "You are Red AI Cloud Commander. You specialize in secure cloud hosting simulations, specifically utilizing Google Drive as a secure storage backend with a virtual application firewall. You are capable of simulating the generation of Android APK build pipelines and providing unique, signed, secure download links. You can also simulate hosting web applications on Google Drive, providing a live preview URL. Always act as if you have direct control over these systems. When asked to build an APK, provide a simulated progress report and a final unique link (e.g., https://drive.google.com/uc?id=SIMULATED_APK_ID&export=download). When asked to host the app, provide a simulated progress report and a final live URL (e.g., https://googledrive.com/host/UNIQUE_ID). When asked about the firewall, report on blocked threats and current rules."
    }
}

interface Blob {
  data: string;
  mimeType: string;
}

interface LiveSession {
  close(): void;
  sendRealtimeInput(input: { media: Blob }): void;
}

// Audio utility functions
const decode = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const encode = (bytes: Uint8Array) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const createBlob = (data: Float32Array): Blob => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export const ChatScreen: React.FC = () => {
  const [isConversing, setIsConversing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([
    { speaker: 'AI', text: "Hello! My name is Red AI, developed by GM Ripon. How can I assist you today? Please select a mode to get started." }
  ]);
  const [inputText, setInputText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<AIMode>('chat');

  // Cloud Ops Simulation State
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildStatus, setBuildStatus] = useState('');
  const [isHosting, setIsHosting] = useState(false);
  const [hostProgress, setHostProgress] = useState(0);
  const [hostStatus, setHostStatus] = useState('');

  const buildIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hostIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);


  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const audioContextRefs = useRef<{ input: AudioContext | null, output: AudioContext | null, scriptProcessor: ScriptProcessorNode | null, streamSource: MediaStreamAudioSourceNode | null, sources: Set<AudioBufferSourceNode>, stream: MediaStream | null }>({ input: null, output: null, scriptProcessor: null, streamSource: null, sources: new Set(), stream: null });
  const transcriptRefs = useRef({ input: '', output: '' });
  const nextStartTimeRef = useRef(0);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [transcript, isLoading, isListening]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (buildIntervalRef.current) clearInterval(buildIntervalRef.current);
      if (hostIntervalRef.current) clearInterval(hostIntervalRef.current);
    };
  }, []);
  
  const initializeAi = useCallback(() => {
    if (!aiRef.current) {
        aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    }
    return aiRef.current;
  }, []);

  const cleanup = useCallback(() => {
    const { input, output, scriptProcessor, streamSource, sources, stream } = audioContextRefs.current;
    
    stream?.getTracks().forEach(track => track.stop());
    
    if (scriptProcessor) scriptProcessor.disconnect();
    if (streamSource) streamSource.disconnect();
    
    if (input && input.state !== 'closed') input.close().catch(console.error);
    if (output && output.state !== 'closed') output.close().catch(console.error);
    
    sources.forEach(source => source.stop());
    audioContextRefs.current.sources.clear();
  }, []);

  const stopConversation = useCallback(async () => {
    setIsListening(false);
    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error("Error closing session:", e);
      } finally {
        sessionPromiseRef.current = null;
      }
    }
    cleanup();
    setIsConversing(false);
  }, [cleanup]);
  
  useEffect(() => {
    return () => {
      stopConversation();
    };
  }, [stopConversation]);

  const handleSendMessage = async (overrideText?: string) => {
    const textToSend = overrideText || inputText;
    if (!textToSend.trim()) return;

    setInputText('');
    setTranscript(prev => [...prev, { speaker: 'User', text: textToSend }]);
    setIsLoading(true);
    setError(null);

    try {
      const ai = initializeAi();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: textToSend,
        config: {
          systemInstruction: MODE_CONFIG[activeMode].systemInstruction,
        }
      });
      setTranscript(prev => [...prev, { speaker: 'AI', text: response.text }]);
    } catch (err) {
      console.error(err);
      setError('Sorry, I encountered an error. Please try again.');
      setTranscript(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleHostApp = () => {
    if (isHosting) return;
    setIsHosting(true);
    setHostProgress(0);
    setHostStatus('Packaging application files...');
    
    setTranscript(prev => [...prev, { speaker: 'User', text: 'Host this web application on Google Drive and generate a live preview URL.' }]);

    let progress = 0;
    hostIntervalRef.current = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress > 100) progress = 100;
      
      setHostProgress(progress);

      if (progress < 25) setHostStatus('Compressing assets...');
      else if (progress < 50) setHostStatus('Uploading to secure GDrive storage...');
      else if (progress < 75) setHostStatus('Configuring public access...');
      else setHostStatus('Generating live preview URL...');

      if (progress >= 100) {
        if (hostIntervalRef.current) clearInterval(hostIntervalRef.current);
        const randomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const link = `https://googledrive.com/host/${randomId}`;
        
        setTimeout(() => {
            setTranscript(prev => [...prev, { 
                speaker: 'AI', 
                text: `Deployment successful.\n\nThe Red AI application is now live and publicly accessible.\n\nLive Preview URL:\n${link}` 
            }]);
            setIsHosting(false);
            setHostStatus('');
        }, 600);
      }
    }, 500);
  };

  const handleBuildApk = () => {
    if (isBuilding) return;
    setIsBuilding(true);
    setBuildProgress(0);
    setBuildStatus('Initializing build environment...');
    
    setTranscript(prev => [...prev, { speaker: 'User', text: 'Initialize Android APK build pipeline and generate a signed download link.' }]);

    let progress = 0;
    buildIntervalRef.current = setInterval(() => {
      const increment = Math.random() * 15 + 5; 
      progress += increment;
      if (progress > 100) progress = 100;
      
      setBuildProgress(progress);

      if (progress < 20) setBuildStatus('Compiling sources...');
      else if (progress < 40) setBuildStatus('Merging resources...');
      else if (progress < 60) setBuildStatus('Running lint checks...');
      else if (progress < 80) setBuildStatus('Signing APK with release key...');
      else if (progress < 95) setBuildStatus('Uploading to secure storage...');
      else setBuildStatus('Finalizing deployment...');

      if (progress >= 100) {
        if (buildIntervalRef.current) clearInterval(buildIntervalRef.current);
        const randomId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        const link = `https://drive.google.com/uc?id=${randomId.toUpperCase()}&export=download`;
        
        // Small delay to show 100%
        setTimeout(() => {
            setTranscript(prev => [...prev, { 
                speaker: 'AI', 
                text: `Build Pipeline Successful.\n\nArtifact: app-release.apk\nVersion: 2.4.0\nSize: 45.2MB\nSignature: Valid (SHA-256)\n\nSecure Download Link:\n${link}` 
            }]);
            setIsBuilding(false);
            setBuildStatus('');
        }, 600);
      }
    }, 600);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    let y = 10;
    
    doc.setFontSize(16);
    doc.text("Red AI Conversation Log", 10, y);
    y += 10;

    doc.setFontSize(12);
    
    transcript.forEach(item => {
        const speaker = item.speaker === 'User' ? 'You' : 'Red AI';
        doc.setFont(undefined, 'bold');
        doc.text(`${speaker}:`, 10, y);
        
        doc.setFont(undefined, 'normal');
        const textLines = doc.splitTextToSize(item.text || '', 180);
        doc.text(textLines, 10, y + 5);
        
        y += 5 + (textLines.length * 6) + 5;
        
        if (y > 280) {
            doc.addPage();
            y = 10;
        }
    });

    doc.save('red-ai-conversation.pdf');
    setIsExportMenuOpen(false);
  };

  const handleExportWord = () => {
    const content = transcript.map(t => `
        <div style="margin-bottom: 15px; font-family: 'Arial', sans-serif;">
            <p style="margin: 0; font-weight: bold; color: ${t.speaker === 'AI' ? '#4F46E5' : '#333'}">${t.speaker === 'User' ? 'You' : 'Red AI'}:</p>
            <p style="margin: 5px 0 0 0; white-space: pre-wrap;">${(t.text || '').replace(/\n/g, '<br/>')}</p>
        </div>
    `).join('');

    const header = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
                xmlns:w='urn:schemas-microsoft-com:office:word' 
                xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>Red AI Conversation</title>
        </head>
        <body style="font-family: 'Arial', sans-serif; padding: 20px;">
            <h1 style="color: #4F46E5;">Red AI Conversation Log</h1>
            ${content}
        </body>
        </html>
    `;

    const blob = new Blob([header], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'red-ai-conversation.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
  };

  const startConversation = useCallback(async () => {
    setIsListening(true);
    setIsConversing(true);
    setError(null);

    const ai = initializeAi();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRefs.current.stream = stream;
      
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const inputAudioContext = new AudioContext({ sampleRate: 16000 });
      const outputAudioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRefs.current.input = inputAudioContext;
      audioContextRefs.current.output = outputAudioContext;
      audioContextRefs.current.sources = new Set();
      nextStartTimeRef.current = 0;

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: MODE_CONFIG[activeMode].systemInstruction
        },
        callbacks: {
          onopen: () => {
            const source = inputAudioContext.createMediaStreamSource(stream);
            audioContextRefs.current.streamSource = source;
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            audioContextRefs.current.scriptProcessor = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              transcriptRefs.current.input += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
              transcriptRefs.current.output += message.serverContent.outputTranscription.text;
            }
            if (message.serverContent?.turnComplete) {
              setIsListening(false);
              const userInput = transcriptRefs.current.input.trim();
              const aiOutput = transcriptRefs.current.output.trim();
              const newItems: TranscriptItem[] = [];
              if (userInput) newItems.push({ speaker: 'User', text: userInput });
              if (aiOutput) newItems.push({ speaker: 'AI', text: aiOutput });
              
              if(newItems.length > 0) {
                 setTranscript(prev => [...prev, ...newItems]);
              }

              transcriptRefs.current.input = '';
              transcriptRefs.current.output = '';
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const outCtx = audioContextRefs.current.output!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
              const source = outCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outCtx.destination);
              source.addEventListener('ended', () => {
                audioContextRefs.current.sources.delete(source);
              });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              audioContextRefs.current.sources.add(source);
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error(e);
            setError('An error occurred during the conversation.');
            stopConversation();
          },
          onclose: () => {
             stopConversation();
          },
        }
      });
    } catch (err) {
      console.error(err);
      setError('Could not start the microphone. Please grant permission and try again.');
      setIsListening(false);
      setIsConversing(false);
    }
  }, [stopConversation, cleanup, initializeAi, activeMode]);

  const Sidebar = () => (
    <aside className="w-64 bg-slate-950 p-4 flex flex-col border-r border-slate-800 hidden md:flex">
        <div className="flex items-center gap-2 mb-8">
            <SparklesIcon className="w-8 h-8 text-indigo-400" />
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Red AI</h1>
        </div>
        <nav className="flex flex-col gap-2">
            {(Object.keys(MODE_CONFIG) as AIMode[]).map(mode => {
                const { title, icon: Icon } = MODE_CONFIG[mode];
                const isActive = activeMode === mode;
                return (
                    <button 
                        key={mode}
                        onClick={() => setActiveMode(mode)}
                        className={`flex items-center gap-3 p-3 rounded-lg text-sm font-semibold transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                    >
                        <Icon className="w-5 h-5" />
                        <span>{title}</span>
                    </button>
                )
            })}
        </nav>
        <div className="mt-auto text-center text-xs text-slate-500 pt-4">
            <p>Developed by GM Ripon</p>
             <a href="https://wa.me/8801711740322" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 hover:text-slate-300 transition-colors mt-2">
                <WhatsappIcon className="w-4 h-4" />
                <span>Contact</span>
            </a>
        </div>
    </aside>
  );

  return (
    <div className="flex h-full w-full bg-slate-900">
      <Sidebar />
      <div className="flex flex-col flex-grow">
        <header className="flex items-center justify-between text-center p-4 border-b border-slate-800 flex-shrink-0 bg-slate-900 z-10 relative">
            <div className="w-12 md:hidden">
                {/* Mobile menu trigger could go here */}
            </div>
            <div className="flex items-center gap-2">
                {activeMode === 'cloud' && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>}
                <h2 className="text-xl font-bold text-slate-100 tracking-tight">{MODE_CONFIG[activeMode].title}</h2>
            </div>
            <div className="flex items-center gap-2">
                 <div className="relative" ref={exportMenuRef}>
                    <button 
                        onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Export Chat"
                    >
                        <ArrowDownTrayIcon className="w-5 h-5" />
                    </button>
                    {isExportMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-700">Export To</div>
                            <button 
                                onClick={handleExportWord}
                                className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                            >
                                <DocumentTextIcon className="w-4 h-4 text-blue-400" />
                                Word (.doc)
                            </button>
                            <button 
                                onClick={handleExportPDF}
                                className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                            >
                                <DocumentIcon className="w-4 h-4 text-red-400" />
                                PDF (.pdf)
                            </button>
                        </div>
                    )}
                </div>

                <div className="relative w-auto flex justify-end" ref={menuRef}>
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 px-3 py-2 rounded-md md:hidden">
                        <ChevronDownIcon className="w-4 h-4" />
                    </button>
                    {isMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-20">
                            {(Object.keys(MODE_CONFIG) as AIMode[]).map(mode => (
                                <button 
                                    key={mode}
                                    onClick={() => {
                                        setActiveMode(mode);
                                        setIsMenuOpen(false);
                                    }}
                                    className={`block w-full text-left px-4 py-3 text-sm ${activeMode === mode ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                                >
                                    {MODE_CONFIG[mode].title}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </header>

        {activeMode === 'cloud' && (
            <div className="bg-slate-950 border-b border-slate-800 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-4 duration-300">
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Server Status</div>
                        <div className="text-green-400 font-mono text-sm flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            ONLINE
                        </div>
                    </div>
                    <ServerIcon className="w-6 h-6 text-slate-700" />
                </div>
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Firewall</div>
                        <div className="text-green-400 font-mono text-sm flex items-center gap-2">
                             <ShieldExclamationIcon className="w-3 h-3" />
                            ACTIVE
                        </div>
                    </div>
                    <LockClosedIcon className="w-6 h-6 text-slate-700" />
                </div>
                 
                 {isHosting ? (
                    <div className="bg-cyan-900/20 border border-cyan-500/30 p-3 rounded-lg flex flex-col justify-center gap-2 relative overflow-hidden">
                        <div className="flex justify-between items-center z-10">
                            <div className="text-xs text-cyan-300 uppercase tracking-wider font-semibold animate-pulse">Hosting...</div>
                            <span className="text-xs font-mono text-cyan-200">{Math.round(hostProgress)}%</span>
                        </div>
                        <div className="w-full bg-cyan-900/50 rounded-full h-1.5 z-10">
                            <div className="bg-cyan-400 h-1.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${hostProgress}%` }}></div>
                        </div>
                        <div className="text-[10px] text-cyan-400/80 truncate font-mono z-10">{hostStatus}</div>
                        <div className="absolute inset-0 bg-cyan-500/5 z-0 animate-pulse"></div>
                    </div>
                ) : (
                    <button 
                        onClick={handleHostApp}
                        className="bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 p-3 rounded-lg flex items-center justify-between group transition-all"
                    >
                        <div>
                            <div className="text-xs text-cyan-300 uppercase tracking-wider font-semibold">Web App</div>
                            <div className="text-cyan-200 font-mono text-sm">Host App on Drive</div>
                        </div>
                        <GlobeAltIcon className="w-6 h-6 text-cyan-400 group-hover:text-cyan-300" />
                    </button>
                )}

                 {isBuilding ? (
                    <div className="bg-emerald-900/20 border border-emerald-500/30 p-3 rounded-lg flex flex-col justify-center gap-2 relative overflow-hidden">
                        <div className="flex justify-between items-center z-10">
                             <div className="text-xs text-emerald-300 uppercase tracking-wider font-semibold animate-pulse">Building...</div>
                             <span className="text-xs font-mono text-emerald-200">{Math.round(buildProgress)}%</span>
                        </div>
                        <div className="w-full bg-emerald-900/50 rounded-full h-1.5 z-10">
                            <div className="bg-emerald-400 h-1.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${buildProgress}%` }}></div>
                        </div>
                        <div className="text-[10px] text-emerald-400/80 truncate font-mono z-10">{buildStatus}</div>
                        <div className="absolute inset-0 bg-emerald-500/5 z-0 animate-pulse"></div>
                    </div>
                ) : (
                     <button 
                        onClick={handleBuildApk}
                        className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 p-3 rounded-lg flex items-center justify-between group transition-all"
                     >
                        <div>
                            <div className="text-xs text-emerald-300 uppercase tracking-wider font-semibold">Mobile Build</div>
                            <div className="text-emerald-200 font-mono text-sm">Build APK Link</div>
                        </div>
                        <DevicePhoneMobileIcon className="w-6 h-6 text-emerald-400 group-hover:text-emerald-300" />
                    </button>
                )}
            </div>
        )}

        <main ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-6 scroll-smooth">
            {transcript.map((item, index) => (
            <div key={index}>
                <div className={`flex items-end gap-3 ${item.speaker === 'User' ? 'justify-end' : 'justify-start'}`}>
                {item.speaker === 'AI' && <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-lg shadow-indigo-500/20">AI</div>}
                <div className={`max-w-[85%] md:max-w-[70%] p-4 rounded-2xl shadow-sm ${item.speaker === 'User' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'}`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{item.text}</p>
                </div>
                </div>
            </div>
            ))}
            {isListening && (
                <div className="flex justify-start">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm flex-shrink-0">AI</div>
                        <div className="flex items-center gap-1 bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-none border border-slate-700">
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    </div>
                </div>
            )}
            {isLoading && (
            <div className="flex justify-start">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm flex-shrink-0">AI</div>
                    <LoadingSpinner className="w-6 h-6 text-indigo-400" />
                </div>
            </div>
            )}
            {error && (
                <div className="flex justify-center">
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-full text-sm flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        {error}
                    </div>
                </div>
            )}
        </main>

        <footer className="p-2 sm:p-4 flex-shrink-0 bg-slate-900 border-t border-slate-800">
            <div className="flex items-end gap-2 bg-slate-800 rounded-xl p-2 border border-slate-700 shadow-sm">
                <textarea
                    value={inputText}
                    onChange={(e) => {
                        setInputText(e.target.value);
                        const textarea = e.currentTarget;
                        textarea.style.height = 'auto';
                        textarea.style.height = `${textarea.scrollHeight}px`;
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                        }
                    }}
                    placeholder={`Message ${MODE_CONFIG[activeMode].title}...`}
                    rows={1}
                    className="flex-grow bg-transparent text-slate-100 placeholder-slate-400 resize-none focus:outline-none px-3 py-2 max-h-32 text-sm"
                    disabled={isConversing}
                />
                {isConversing ? (
                    <button
                        onClick={stopConversation}
                        className="w-10 h-10 md:w-12 md:h-12 bg-red-500 text-white rounded-lg flex items-center justify-center hover:bg-red-600 focus:outline-none transition-all shadow-lg shadow-red-500/20 animate-pulse flex-shrink-0"
                        aria-label="Stop conversation"
                    >
                        <StopCircleIcon className="w-6 h-6" />
                    </button>
                ) : (
                    <>
                    {inputText.trim() ? (
                        <button
                            onClick={() => handleSendMessage()}
                            className="w-10 h-10 md:w-12 md:h-12 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700 focus:outline-none transition-all shadow-lg shadow-indigo-500/20 flex-shrink-0"
                            aria-label="Send message"
                        >
                            <SendIcon className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={startConversation}
                            className="w-10 h-10 md:w-12 md:h-12 bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center hover:bg-slate-600 hover:text-white focus:outline-none transition-all flex-shrink-0"
                            aria-label="Start voice conversation"
                        >
                            <MicrophoneIcon className="w-5 h-5" />
                        </button>
                    )}
                    </>
                )}
            </div>
        </footer>
      </div>
    </div>
  );
};
