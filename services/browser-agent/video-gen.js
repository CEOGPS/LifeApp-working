/**
 * Video Generation Handler for browser_agent
 * Uses FFmpeg to generate high-quality videos from images
 */

const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const axios = require("axios");

const router = express.Router();
const TEMP_DIR = path.join(__dirname, ".temp");

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * POST /video/generate
 * Generate video from images
 */
router.post("/video/generate", async (req, res) => {
  const { images, duration, transition, fps, textOverlay, title } = req.body;

  if (!images || images.length === 0) {
    return res.status(400).json({ error: "No images provided" });
  }

  const tempSessionId = `video_${Date.now()}`;
  const sessionDir = path.join(TEMP_DIR, tempSessionId);
  fs.mkdirSync(sessionDir, { recursive: true });

  try {
    // 1. Download images
    console.log(`[${tempSessionId}] Downloading ${images.length} images...`);
    const imagePaths = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const imgPath = path.join(sessionDir, `img_${String(i).padStart(3, "0")}.jpg`);

      if (img.url.startsWith("data:")) {
        // Base64
        const base64Data = img.url.split(",")[1];
        fs.writeFileSync(imgPath, Buffer.from(base64Data, "base64"));
      } else if (img.url.startsWith("http")) {
        // URL - fetch it
        const response = await axios.get(img.url, { responseType: "arraybuffer" });
        fs.writeFileSync(imgPath, response.data);
      }
      imagePaths.push(imgPath);
    }

    // 2. Create concat file for FFmpeg
    const concatFile = path.join(sessionDir, "concat.txt");
    const durationPerImg = duration || 3;
    const frameDuration = 1 / (fps || 24);

    const concatContent = imagePaths
      .map(imgPath => `file '${imgPath}'\nduration ${durationPerImg}`)
      .join("\n");
    fs.writeFileSync(concatFile, concatContent);

    // 3. Build FFmpeg command
    const outputPath = path.join(sessionDir, "output.mp4");
    let ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${concatFile}" `;

    // Add filters
    let filters = [];

    // Scale to standard HD
    filters.push("scale=1280:720:force_original_aspect_ratio=decrease");

    // Add padding to center
    filters.push("pad=1280:720:(ow-iw)/2:(oh-ih)/2");

    // Add text overlay if provided
    if (textOverlay) {
      const escapedText = textOverlay.replace(/'/g, "'\\''");
      filters.push(`drawtext=text='${escapedText}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.5`);
    }

    if (filters.length > 0) {
      ffmpegCmd += `-vf "${filters.join(',')}" `;
    }

    ffmpegCmd += `-c:v libx264 -preset medium -crf 23 -c:a aac "${outputPath}"`;

    console.log(`[${tempSessionId}] Running FFmpeg...`);

    // 4. Execute FFmpeg
    await new Promise((resolve, reject) => {
      exec(ffmpegCmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`FFmpeg error: ${error}`);
          reject(error);
        } else {
          resolve();
        }
      });
    });

    console.log(`[${tempSessionId}] Video generated successfully`);

    // 5. Stream response
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="video_${Date.now()}.mp4"`);

    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);

    // Cleanup when done
    stream.on("end", () => {
      setTimeout(() => {
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (e) {
          console.warn(`Cleanup failed: ${e}`);
        }
      }, 2000);
    });
  } catch (error) {
    console.error(`[${tempSessionId}] Error:`, error);
    res.status(500).json({ error: error.message });

    // Cleanup on error
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (e) {}
  }
});

/**
 * GET /video/health
 * Health check for Node backend
 */
router.get("/video/health", (req, res) => {
  res.json({ status: "ok" });
});

module.exports = router;
