import { useRef, useState } from "react";
import { ErebusFace, type ErebusFaceHandle } from "./ErebusFace";
import { useErebusVoice } from "../hooks/useErebusVoice";

export default function VoiceTest() {
  const faceRef = useRef<ErebusFaceHandle | null>(null);
  const [text, setText] = useState("Erebus is online. Systems nominal.");
  const voice = useErebusVoice({ faceRef });

  return (
    <div className="p-8 space-y-4">
      <ErebusFace ref={faceRef} width={200} />
      <input value={text} onChange={(e) => setText(e.target.value)} className="border p-2 w-full" />
      <button onClick={() => voice.say(text)} className="px-4 py-2 bg-purple-600 text-white rounded">
        Say it
      </button>
      <div className="text-sm">
        Kokoro: {voice.serverOnline === null ? "checking…" : voice.serverOnline ? "online" : "offline"}
        {" · "}Speaking: {voice.isSpeaking ? "yes" : "no"}
        {" · "}Queued: {voice.queued}
      </div>
    </div>
  );
}