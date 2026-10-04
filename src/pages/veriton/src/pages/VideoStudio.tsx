import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  Clapperboard,
  Film,
  Image as ImageIcon,
  Type,
  Wand2,
  Sparkles,
  Play,
  Download,
  Settings2,
  Check,
  ArrowLeft,
  Monitor,
  Smartphone,
  Layers,
  Palette,
  Zap,
} from "lucide-react";
import TiltCard from "@/components/TiltCard";
import ExplodingButton from "@/components/ExplodingButton";
import { motion, AnimatePresence } from "framer-motion";

const CREATION_MODES = [
  {
    id: "text-to-video",
    label: "Text-to-Video",
    icon: Type,
    desc: "Describe scenes, characters & mood. AI generates a timestamped storyboard.",
  },
  {
    id: "photo-animation",
    label: "Photo + Song",
    icon: ImageIcon,
    desc: "Upload 1–5 photos. AI animates with panning/zoom & transitions.",
  },
  {
    id: "template",
    label: "Template Library",
    icon: Layers,
    desc: "Pick a pre-made visual template. AI maps audio frequencies to it.",
  },
  {
    id: "auto-pilot",
    label: "Auto-Pilot",
    icon: Wand2,
    desc: "No input needed. AI analyzes mood/BPM/genre for a fully autonomous video.",
  },
];

const TEMPLATES = [
  "Particle Wave",
  "Retro VHS",
  "Abstract Geometry",
  "Nature Slideshow",
  "Neon Synthwave",
  "Cinematic Film",
];
const FONTS = ["Inter", "Space Grotesk", "Roboto Mono", "Georgia", "Impact"];
const COLORS = ["#FF1A40", "#FFFFFF", "#FFD700", "#00FF88", "#00BFFF"];

export default function VideoStudio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectTrackId = searchParams.get("trackId");
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [mode, setMode] = useState(null);
  const [textPrompt, setTextPrompt] = useState("");
}
