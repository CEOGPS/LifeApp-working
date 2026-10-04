import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import GlobalMusicPlayer from "./GlobalMusicPlayer";
import { PlayerProvider, usePlayer } from "../lib/PlayerContext";

function PlayerWrapper() {
  const { currentTrack, onNext, onPrev, trackList } = usePlayer();
  return (
    <GlobalMusicPlayer
      currentTrack={currentTrack}
      onNext={onNext}
      onPrev={onPrev}
      tracks={trackList}
    />
  );
}

export default function AppLayout() {
  return (
    <PlayerProvider>
      <div className="relative flex min-h-[70vh] gap-4">
        <Sidebar />
        <main className="min-w-0 flex-1 pb-28">
          <Outlet />
        </main>
        <PlayerWrapper />
      </div>
    </PlayerProvider>
  );
}
