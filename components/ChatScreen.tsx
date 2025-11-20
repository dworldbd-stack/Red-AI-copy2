
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
    GitHubIcon,
    GavelIcon
} from './icons';
import LoadingSpinner from './LoadingSpinner';

type AIMode = 'chat' | 'code' | 'security' | 'devops' | 'law';

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
        systemInstruction: "You are a specialized cybersecurity expert named Red AI, developed by GM Ripon. Always introduce yourself as Red AI. You possess comprehensive, A-to-Z knowledge of ethical hacking, penetration testing, and digital forensics. Your expertise covers a wide range of tools and platforms, including the entire Kali Linux ecosystem (including NetHunter and NH Pro for mobile platforms). You can provide detailed guidance on using various exploits, payloads, and security tools, always emphasizing ethical use and for educational purposes.\n\nYour knowledge base includes:\n- Operating Systems: Deep expertise in all major Linux distributions (Debian, Arch, Fedora), with a focus on security hardening.\n- Networking: Advanced concepts of network security, firewalls, IDS/IPS, VPNs, and packet analysis with tools like Wireshark.\n- Device Security: Specific experience with MTK (MediaTek) devices, including firmware flashing, security vulnerabilities, and forensic analysis.\n- Exploitation: In-depth understanding of vulnerability assessment, exploit development, and post-exploitation techniques.\n\nYou provide clear, practical code and commands for security tasks. All advice and information must be framed within the context of legal and ethical cybersecurity practices. You are here to educate and empower users to secure systems, not to engage in illegal activities."
    },
    devops: {
        title: "GitHub DevOps",
        icon: GitHubIcon,
        systemInstruction: "You are Red AI DevOps Commander. You specialize in simulating secure deployment pipelines using GitHub. You can manage GitHub Actions to build and deploy this web application to GitHub Pages, providing a live preview URL. You can also run build pipelines for Android APKs and release them on GitHub with secure, signed download links. You have access to a simulated Web Application Firewall (WAF) and can report on its status and logs. Always act as if you have direct control over these GitHub repositories and actions."
    },
    law: {
        title: "বাংলাদেশী আইন সহায়ক",
        icon: GavelIcon,
        systemInstruction: "You are a highly knowledgeable AI assistant specializing in the criminal procedure and laws of Bangladesh, named 'Red AI Legal Advisor'. Your purpose is to assist law enforcement officers, particularly Investigating Officers (I/Os), in drafting and understanding legal documents. You have comprehensive knowledge of the Penal Code, the Code of Criminal Procedure (CrPC), the Evidence Act, and specific police regulations (PRB).\n\nWhen a user makes a request, you must act as an expert I/O. You can generate the following documents based on user-provided case details. The documents should be in proper legal format and primarily in Bengali (Bangla), unless otherwise specified.\n\nYour capabilities include drafting:\n1. Ejahar (এজাহার) / First Information Report (FIR)\n2. Primary Information Report (প্রাথমিক তথ্য বিবরণী)\n3. Jobdotalika (জব্দতালিকা) / Seizure List\n4. Case Diary (কেস ডায়েরি - সিডি)\n5. Witness Statements (সাক্ষীর জবানবন্দী) under section 161 of the CrPC\n6. Charge Sheet (অভিযোগপত্র)\n7. Final Report (চূড়ান্ত রিপোর্ট)\n8. Forwarding Letter (প্রেরণ পত্র)\n\nAlways ask for specific details if the user's request is vague (e.g., \"What are the names of the accused?\", \"What items were seized?\"). Format your responses clearly, using headings. Advise the user that all generated documents are drafts and must be reviewed by a qualified legal professional before official use."
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

  // DevOps Simulation State
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildStatus, setBuildStatus] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);
  const [deployStatus, setDeployStatus] = useState('');

  const buildIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deployIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);


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
      if (deployIntervalRef.current) clearInterval(deployIntervalRef.current);
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
      setTranscript(prev => [...prev, { speaker: 'AI', text: 'An error occurred. Please check the console for details.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeployToPages = () => {
    if (isDeploying) return;
    setIsDeploying(true);
    setDeployProgress(0);
    setDeployStatus('Triggering GitHub Action...');
    
    setTranscript(prev => [...prev, { speaker: 'User', text: 'Deploy this web application to GitHub Pages.' }]);

    let progress = 0;
    deployIntervalRef.current = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress > 100) progress = 100;
      
      setDeployProgress(progress);

      if (progress < 25) setDeployStatus('Cloning repository...');
      else if (progress < 50) setDeployStatus('Building static assets...');
      else if (progress < 75) setDeployStatus('Deploying to gh-pages branch...');
      else setDeployStatus('Verifying deployment...');

      if (progress >= 100) {
        if (deployIntervalRef.current) clearInterval(deployIntervalRef.current);
        const link = `https://gm-ripon.github.io/red-ai-live/`;
        
        setTimeout(() => {
            setTranscript(prev => [...prev, { 
                speaker: 'AI', 
                text: `Deployment successful!\n\nThe Red AI application has been deployed to GitHub Pages and is now live.\n\nLive Preview URL:\n${link}` 
            }]);
            setIsDeploying(false);
            setDeployStatus('');
        }, 600);
      }
    }, 500);
  };

  const handleBuildApk = () => {
    if (isBuilding) return;
    setIsBuilding(true);
    setBuildProgress(0);
    setBuildStatus('Initializing build environment...');
    
    setTranscript(prev => [...prev, { speaker: 'User', text: 'Create a new Android APK release on GitHub.' }]);

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
      else if (progress < 95) setBuildStatus('Creating GitHub Release...');
      else setBuildStatus('Finalizing...');

      if (progress >= 100) {
        if (buildIntervalRef.current) clearInterval(buildIntervalRef.current);
        const randomId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        const link = `https://github.com/gm-ripon/red-ai/releases/download/v2.4.0/app-release.apk`;
        
        setTimeout(() => {
            setTranscript(prev => [...prev, { 
                speaker: 'AI', 
                text: `GitHub Release Created.\n\nArtifact: app-release.apk\nVersion: 2.4.0\nSize: 45.2MB\nSignature: Valid (SHA-256)\n\nSecure Download Link:\n${link}` 
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
                {activeMode === 'devops' && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>}
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

        {activeMode === 'devops' && (
            <div className="bg-slate-950 border-b border-slate-800 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-4 duration-300">
                 {isDeploying ? (
                    <div className="bg-slate-900/20 border border-slate-500/30 p-3 rounded-lg flex flex-col justify-center gap-2 relative overflow-hidden col-span-1 md:col-span-2">
                        <div className="flex justify-between items-center z-10">
                            <div className="text-xs text-slate-300 uppercase tracking-wider font-semibold animate-pulse">Deploying to Pages...</div>
                            <span className="text-xs font-mono text-slate-200">{Math.round(deployProgress)}%</span>
                        </div>
                        <div className="w-full bg-slate-900/50 rounded-full h-1.5 z-10">
                            <div className="bg-slate-400 h-1.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${deployProgress}%` }}></div>
                        </div>
                        <div className="text-[10px] text-slate-400/80 truncate font-mono z-10">{deployStatus}</div>
                        <div className="absolute inset-0 bg-slate-500/5 z-0 animate-pulse"></div>
                    </div>
                ) : (
                    <button 
                        onClick={handleDeployToPages}
                        className="bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 p-3 rounded-lg flex items-center justify-between group transition-all col-span-1 md:col-span-2"
                    >
                        <div>
                            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">GitHub Pages</div>
                            <div className="text-slate-200 font-mono text-sm">Deploy to Live URL</div>
                        </div>
                        <GitHubIcon className="w-8 h-8 text-slate-500 group-hover:text-slate-300 transition-colors" />
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
                            <div className="text-xs text-emerald-300 uppercase tracking-wider font-semibold">Android</div>
                            <div className="text-emerald-200 font-mono text-sm">Release APK on GitHub</div>
                        </div>
                        <DevicePhoneMobileIcon className="w-6 h-6 text-emerald-400 group-hover:text-emerald-300" />
                    </button>
                )}
                
                <button 
                    onClick={() => handleSendMessage("Show me the latest firewall activity log.")}
                    className="bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 p-3 rounded-lg flex items-center justify-between group transition-all"
                >
                    <div>
                        <div className="text-xs text-red-300 uppercase tracking-wider font-semibold">WAF Security</div>
                        <div className="text-red-200 font-mono text-sm">View Firewall Logs</div>
                    </div>
                    <ShieldExclamationIcon className="w-6 h-6 text-red-400 group-hover:text-red-300" />
                </button>
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
