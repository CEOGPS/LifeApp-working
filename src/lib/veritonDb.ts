// src/lib/veritonDb.ts
// Veriton music database operations

import { supabase } from "./supabaseClient";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  audio_url: string;
  cover_url?: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  key?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  cover_url?: string;
  tracks: string[]; // track IDs
  created_at: string;
  updated_at: string;
  user_id: string;
}

export async function getTracks(userId: string): Promise<Track[]> {
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getTrack(trackId: string): Promise<Track | null> {
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("id", trackId)
    .single();
  
  if (error) return null;
  return data;
}

export async function createTrack(track: Omit<Track, "id" | "created_at" | "updated_at">): Promise<Track> {
  const { data, error } = await supabase
    .from("tracks")
    .insert(track)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateTrack(trackId: string, updates: Partial<Track>): Promise<Track> {
  const { data, error } = await supabase
    .from("tracks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", trackId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteTrack(trackId: string): Promise<void> {
  const { error } = await supabase
    .from("tracks")
    .delete()
    .eq("id", trackId);
  
  if (error) throw error;
}

export async function getPlaylists(userId: string): Promise<Playlist[]> {
  const { data, error } = await supabase
    .from("playlists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function createPlaylist(playlist: Omit<Playlist, "id" | "created_at" | "updated_at">): Promise<Playlist> {
  const { data, error } = await supabase
    .from("playlists")
    .insert(playlist)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updatePlaylist(playlistId: string, updates: Partial<Playlist>): Promise<Playlist> {
  const { data, error } = await supabase
    .from("playlists")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", playlistId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  const { error } = await supabase
    .from("playlists")
    .delete()
    .eq("id", playlistId);
  
  if (error) throw error;
}

export async function addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
  const playlist = await getPlaylist(playlistId);
  if (!playlist) throw new Error("Playlist not found");
  
  const tracks = [...(playlist.tracks || []), trackId];
  await updatePlaylist(playlistId, { tracks });
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
  const playlist = await getPlaylist(playlistId);
  if (!playlist) throw new Error("Playlist not found");
  
  const tracks = (playlist.tracks || []).filter(id => id !== trackId);
  await updatePlaylist(playlistId, { tracks });
}

export async function getPlaylist(playlistId: string): Promise<Playlist | null> {
  const { data, error } = await supabase
    .from("playlists")
    .select("*")
    .eq("id", playlistId)
    .single();
  
  if (error) return null;
  return data;
}

// Export db object for backward compatibility
export const db = {
  tracks: {
    getAll: getTracks,
    get: getTrack,
    create: createTrack,
    update: updateTrack,
    delete: deleteTrack,
  },
  playlists: {
    getAll: getPlaylists,
    get: getPlaylist,
    create: createPlaylist,
    update: updatePlaylist,
    delete: deletePlaylist,
    addTrack: addTrackToPlaylist,
    removeTrack: removeTrackFromPlaylist,
  },
};