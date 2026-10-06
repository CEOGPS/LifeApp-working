// Simple view switching
(function () {
  const navItems = document.querySelectorAll(".co-nav-item");
  const views = document.querySelectorAll(".co-view");
  const ctaButtons = document.querySelectorAll(".co-cta-btn");

  function showView(viewId) {
    views.forEach(v => v.classList.remove("co-active"));
    navItems.forEach(n => n.classList.remove("co-active"));

    const targetView = document.getElementById("co-view-" + viewId);
    if (targetView) targetView.classList.add("co-active");

    navItems.forEach(n => {
      if (n.getAttribute("data-view") === viewId) {
        n.classList.add("co-active");
      }
    });
  }

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const view = item.getAttribute("data-view");
      showView(view);
    });
  });

  ctaButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-view");
      showView(view);
    });
  });

  // Default view
  showView("dashboard");
})();

// Image generation
document.getElementById("co-image-generate").addEventListener("click", async () => {
  const prompt = document.getElementById("co-image-prompt").value;
  const model = document.getElementById("co-image-model").value;
  const resultBox = document.getElementById("co-image-result");
  const history = document.getElementById("co-image-history");

  if (!prompt.trim()) {
    resultBox.innerHTML = "Please enter a prompt.";
    return;
  }

  resultBox.innerHTML = "Generating image...";

  try {
    const res = await fetch("/api/generate/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model })
    });
    const data = await res.json();

    resultBox.innerHTML = `<img src="${data.output}" style="max-width:100%; border-radius:8px;" />`;
    const item = document.createElement("div");
    item.textContent = `Image: ${prompt}`;
    history.prepend(item);
  } catch (e) {
    resultBox.innerHTML = "Error generating image.";
  }
});

// Video generation
document.getElementById("co-video-generate").addEventListener("click", async () => {
  const prompt = document.getElementById("co-video-prompt").value;
  const source = document.getElementById("co-video-source").value;
  const resultBox = document.getElementById("co-video-result");
  const history = document.getElementById("co-video-history");

  if (!prompt.trim()) {
    resultBox.innerHTML = "Please enter a prompt.";
    return;
  }

  resultBox.innerHTML = "Generating video...";

  try {
    const res = await fetch("/api/generate/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, source })
    });
    const data = await res.json();

    resultBox.innerHTML = `<video controls style="max-width:100%; border-radius:8px;"><source src="${data.output}" /></video>`;
    const item = document.createElement("div");
    item.textContent = `Video: ${prompt}`;
    history.prepend(item);
  } catch (e) {
    resultBox.innerHTML = "Error generating video.";
  }
});

// Audio generation
document.getElementById("co-audio-generate").addEventListener("click", async () => {
  const prompt = document.getElementById("co-audio-prompt").value;
  const type = document.getElementById("co-audio-type").value;
  const resultBox = document.getElementById("co-audio-result");
  const history = document.getElementById("co-audio-history");

  if (!prompt.trim()) {
    resultBox.innerHTML = "Please enter a prompt.";
    return;
  }

  resultBox.innerHTML = "Generating audio...";

  try {
    const res = await fetch("/api/generate/audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, type })
    });
    const data = await res.json();

    resultBox.innerHTML = `<audio controls><source src="${data.output}" /></audio>`;
    const item = document.createElement("div");
    item.textContent = `Audio (${type}): ${prompt}`;
    history.prepend(item);
  } catch (e) {
    resultBox.innerHTML = "Error generating audio.";
  }
});

// Writing generation
document.getElementById("co-writing-generate").addEventListener("click", async () => {
  const prompt = document.getElementById("co-writing-prompt").value;
  const type = document.getElementById("co-writing-type").value;
  const resultBox = document.getElementById("co-writing-result");

  if (!prompt.trim()) {
    resultBox.innerHTML = "Please enter instructions.";
    return;
  }

  resultBox.innerHTML = "Generating text...";

  try {
    const res = await fetch("/api/generate/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, type })
    });
    const data = await res.json();

    resultBox.innerHTML = `<pre style="white-space:pre-wrap;">${data.output}</pre>`;
  } catch (e) {
    resultBox.innerHTML = "Error generating text.";
  }
});
