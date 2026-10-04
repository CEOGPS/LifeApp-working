import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Mic, MicOff, Settings, X, Volume2, VolumeX } from 'lucide-react';
import { useAIStore } from '../store/aiStore';
import AvatarCanvas from './AvatarCanvas';

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: Event) => void;
    onend: () => void;
  }
  interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
  }
  interface SpeechRecognitionResultList {
    [index: number]: SpeechRecognitionResult;
  }
  interface SpeechRecognitionResult {
    [index: number]: SpeechRecognitionAlternative;
  }
  interface SpeechRecognitionAlternative {
    readonly transcript: string;
  }
  var SpeechRecognition: {
    prototype: SpeechRecognition;
    new (): SpeechRecognition;
  };
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 32, y: 120 });
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', content: "Cage, what's the move today in Atlanta? Let's stack some wins." }
  ]);
  const [input, setInput] = useState('');
  const dockRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { voiceEnabled, toggleVoice } = useAIStore();

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition(prev => ({
        x: Math.max(20, Math.min(window.innerWidth - 360, prev.x + e.movementX)),
        y: Math.max(20, Math.min(window.innerHeight - 640, prev.y + e.movementY))
      }));
    };

    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Browser Speech Synthesis - free & crisp
  const speak = (text: string) => {
    if (!voiceEnabled || isSpeaking) return;

    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1.05;
    utterance.rate = 1.08;
    utterance.volume = 0.92;

    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // Speech Recognition (free)
  const toggleVoiceInput = () => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      alert("Your browser doesn't support voice input. Use Chrome for best results.");
      return;
    }

    if (!isListening) {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        // Auto send after short pause
        setTimeout(() => {
          if (transcript.trim()) sendMessage(transcript);
        }, 300);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
      setIsListening(true);
      recognitionRef.current = recognition;
    } else {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const sendMessage = async (forcedText?: string) => {
    const messageText = forcedText || input.trim();
    if (!messageText) return;

    const userMsg = { id: Date.now(), role: 'user', content: messageText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Simulated smart response (replace with real backend later)
    setTimeout(() => {
      const responses = [
        "Solid. Let's get that contractor lead flow printing money in Buckhead.",
        "Noted, boss. Your SaaS hitting $100K MRR in 90 days is locked in.",
        "Got it. What's next on the CEO GPS roadmap?"
      ];
      const aiResponse = responses[Math.floor(Math.random() * responses.length)];

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: aiResponse
      }]);

      if (voiceEnabled) speak(aiResponse);
    }, 850);
  };

  return (
    <div
      ref={dockRef}
      className="ai-dock fixed z-50 bg-zinc-900 border border-zinc-700 rounded-3xl overflow-hidden w-80 shadow-2xl select-none"
      style={{ left: position.x, top: position.y }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex items-center justify-between p-4 border-b border-zinc-700 bg-zinc-950">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-xs font-bold">CG</div>
          <div>
            <div className="font-semibold">LifeOS Companion</div>
            <div className="text-emerald-400 text-xs">Always on • Free mode</div>
          </div>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 hover:bg-zinc-800 rounded-xl no-drag">
          {isOpen ? <X size={18} /> : <MessageCircle size={18} />}
        </button>
      </div>

      <div className="pt-6 pb-4">
        <AvatarCanvas isTalking={isSpeaking || isListening} />
      </div>

      <div className="px-6 py-4 flex justify-center gap-8 border-b border-zinc-700">
        <button
          onClick={toggleVoiceInput}
          className={`flex flex-col items-center gap-1 text-xs transition-colors ${isListening ? 'text-red-400' : 'text-zinc-400 hover:text-white'}`}
        >
          {isListening ? <Mic size={22} /> : <MicOff size={22} />}
          <span>Voice In</span>
        </button>

        <button
          onClick={toggleVoice}
          className="flex flex-col items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          {voiceEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
          <span>Voice Out</span>
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 420, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col"
          >
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] px-4 py-3 rounded-2xl text-[15px] ${
                    msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-zinc-800'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-zinc-700 bg-zinc-900">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="What are we building today?"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-violet-500 text-sm"
                />
                <button
                  onClick={() => sendMessage()}
                  className="bg-violet-600 hover:bg-violet-700 w-12 rounded-2xl flex items-center justify-center text-xl active:scale-95 transition-all"
                >
                  ↑
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}