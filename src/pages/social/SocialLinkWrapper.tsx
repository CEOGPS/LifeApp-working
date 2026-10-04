// src/pages/social/SocialLinkWrapper.tsx
// Wrapper for SocialLink - placeholder since SocialLink is a Python-based app

import React from "react";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Globe, Share2, X } from "lucide-react";

// Custom SVG icons for all social platforms
const LinkedInIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-.126-1.28-.072-1.687.072-4.947.058-1.28.072-1.689.072-4.948 0-3.26-.013-3.667-.072-4.947.196-4.354 2.618-6.78 6.98-6.98 1.281-.058 1.69-.072 4.948-.072zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4s1.791-4 4-4 4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.646 1.439-1.44s-.644-1.439-1.439-1.44z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.991 3.857 11.028 9.111 11.829v-8.504H7.184v-3.47h3.039V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.504C18.143 23.101 22 18.069 22 12.073z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM10 15.817V8.183l7.285 3.817-7.285 3.817z"/>
  </svg>
);

const XIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 9.24-3.308.844L12 13.046l-7.214 8.122-3.309-.844 8.502-9.241L2.49 2.25h3.308l7.227 8.26 8.502-9.24-3.308-.844L12 10.954l7.214-8.122-3.309.844-8.502 9.241L21.51 2.25h-3.308z"/>
  </svg>
);

export default function SocialLinkWrapper() {
  return (
    <PanelLayout
      title="SocialLink"
      subtitle="Social media management & analytics platform"
      icon={<Globe className="text-teal-400" />}
    >
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Globe className="w-16 h-16 text-teal-400 mb-6" />
        <h2 className="text-2xl font-bold text-white mb-4">SocialLink</h2>
        <p className="text-white/60 mb-8 max-w-md">
          SocialLink is a Python-based social media management platform with OAuth integrations
          for multiple platforms. The React frontend is currently being migrated.
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl">
          {[
            { icon: <LinkedInIcon />, name: "LinkedIn", color: "text-blue-400" },
            { icon: <XIcon />, name: "Twitter/X", color: "text-sky-400" },
            { icon: <InstagramIcon />, name: "Instagram", color: "text-pink-400" },
            { icon: <FacebookIcon />, name: "Facebook", color: "text-blue-600" },
            { icon: <YouTubeIcon />, name: "YouTube", color: "text-red-400" },
            { icon: <Share2 className="w-8 h-8" />, name: "Cross-Post", color: "text-purple-400" },
          ].map(({ icon, name, color }) => (
            <div key={name} className="flex flex-col items-center gap-2 p-4 glass rounded-xl border border-white/5 hover:border-primary/30 transition-colors">
              <div className={`w-8 h-8 ${color} flex items-center justify-center`}>
                {icon}
              </div>
              <span className="text-sm font-medium text-white">{name}</span>
            </div>
          ))}
        </div>
        
        <div className="mt-8 p-4 glass rounded-xl border border-white/10 max-w-md text-left">
          <h3 className="font-bold text-white mb-2">Status</h3>
          <p className="text-white/70 text-sm mb-4">
            The SocialLink platform includes:
          </p>
          <ul className="text-white/60 text-sm space-y-1">
            <li>• Multi-platform OAuth (LinkedIn, Twitter, Instagram, Facebook, YouTube)</li>
            <li>• Cross-posting & scheduling</li>
            <li>• Analytics aggregation</li>
            <li>• Media library management</li>
            <li>• Team collaboration features</li>
          </ul>
          <p className="text-amber-400 text-sm mt-4">
            ⚠️ React frontend migration in progress. Full UI coming soon.
          </p>
        </div>
      </div>
    </PanelLayout>
  );
}