from pathlib import Path
p = Path(r"D:\dev\LifeApp\src\pages\creator\CreatorWrapper.tsx")
t = p.read_text(encoding="utf-8")

old = '''      if (mode === "music" || (mode === "voice" && result?.url)) {
        if (!result?.url) throw new Error("Generate audio first");
        const track = await saveAudioToMusicLibrary({
          title,
          sourceUrl: result.url,
          genre: mode === "voice" ? "Voice" : "Creator",
        });
        // Also stash song companion for music video if present
        if (mode === "musicvideo" && songFile) {
          await saveAudioToMusicLibrary({ title: `${title} (song)`, file: songFile });
        }
        pushRecent({
          id: track.id,
          title: track.title,
          kind: mode,
          dest: "music",
          created_at: new Date().toISOString(),
        });
        setRecents(readRecents());
        pushToast("success", "Saved to Music Hub library");
        setProgress("Saved audio");
        return;
      }

      if (mode === "musicvideo" && songFile) {
        await saveAudioToMusicLibrary({
          title: `${title} (track)`,
          file: songFile,
          genre: "Creator",
        });
      }

      if (!result?.url) throw new Error("Generate something first");
      const isVideo = mode === "img2vid" || mode === "txt2vid" || mode === "musicvideo";
      const isAudio = mode === "music" || mode === "voice";
      if (isAudio) {
        const track = await saveAudioToMusicLibrary({ title, sourceUrl: result.url });
        pushRecent({
          id: track.id,
          title: track.title,
          kind: mode,
          dest: "music",
          created_at: new Date().toISOString(),
        });
        setRecents(readRecents());
        pushToast("success", "Saved to Music Hub");
      } else {
        const ext = isVideo ? "mp4" : "png";
        const mime = isVideo ? "video/mp4" : "image/png";
        const item = await saveToCreatorMedia({
          title,
          kind: isVideo ? "video" : "image",
          mime,
          filename: `${(title || "creator").replace(/[^a-zA-Z0-9._-]+/g, "_")}.${ext}`,
          sourceUrl: result.url,
          tags: [mode, result.source],
        });
        pushRecent({
          id: item.id,
          title: item.title,
          kind: mode,
          dest: "media",
          created_at: item.created_at,
        });
        setRecents(readRecents());
        pushToast("success", "Saved to Media → Creator album");
      }
      setProgress("Saved");'''

new = '''      // Audio modes → Music Hub
      if (mode === "music" || mode === "voice") {
        if (!result?.url) throw new Error("Generate audio first");
        const track = await saveAudioToMusicLibrary({
          title,
          sourceUrl: result.url,
          genre: mode === "voice" ? "Voice" : "Creator",
        });
        pushRecent({
          id: track.id,
          title: track.title,
          kind: mode,
          dest: "music",
          created_at: new Date().toISOString(),
        });
        setRecents(readRecents());
        pushToast("success", "Saved to Music Hub library");
        setProgress("Saved audio");
        return;
      }

      // Optional song companion for music video
      if (mode === "musicvideo" && songFile) {
        await saveAudioToMusicLibrary({
          title: title + " (track)",
          file: songFile,
          genre: "Creator",
        });
      }

      if (!result?.url) throw new Error("Generate something first");
      const isVideo = mode === "img2vid" || mode === "txt2vid" || mode === "musicvideo";
      const ext = isVideo ? "mp4" : "png";
      const mime = isVideo ? "video/mp4" : "image/png";
      const item = await saveToCreatorMedia({
        title,
        kind: isVideo ? "video" : "image",
        mime,
        filename: (title || "creator").replace(/[^a-zA-Z0-9._-]+/g, "_") + "." + ext,
        sourceUrl: result.url,
        tags: [mode, result.source],
      });
      pushRecent({
        id: item.id,
        title: item.title,
        kind: mode,
        dest: "media",
        created_at: item.created_at,
      });
      setRecents(readRecents());
      pushToast("success", "Saved to Media → Creator album");
      setProgress("Saved");'''

if old not in t:
    print("OLD_BLOCK_NOT_FOUND")
    # find around onSave music
    idx = t.find('if (mode === "music"')
    print(repr(t[idx:idx+400]))
else:
    p.write_text(t.replace(old, new, 1), encoding="utf-8")
    print("save handler fixed")
