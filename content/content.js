// content/content.js
// Runs on YouTube pages. ONLY captures the frame, builds the
// screenshot object, and hands it off to the background service
// worker. No IndexedDB access here.

console.log("LectureSnap Content Script Loaded");

function showToast(message) {
  let toast = document.getElementById("lectureSnapToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "lectureSnapToast";
    Object.assign(toast.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      background: "#222",
      color: "#fff",
      padding: "12px 18px",
      borderRadius: "8px",
      fontSize: "14px",
      fontFamily: "Arial, sans-serif",
      zIndex: "2147483647",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      opacity: "0",
      transition: "opacity 0.3s",
    });
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = "1";
  clearTimeout(toast.hideTimer);
  toast.hideTimer = setTimeout(() => {
    toast.style.opacity = "0";
  }, 2000);
}

function createFloatingButton() {
  if (document.getElementById("lectureSnapFloatingBtn")) return;

  const button = document.createElement("button");
  button.id = "lectureSnapFloatingBtn";
  button.textContent = "📸";
  document.body.appendChild(button);

  Object.assign(button.style, {
    position: "fixed",
    top: "100px",
    right: "20px",
    width: "60px",
    height: "60px",
    border: "none",
    borderRadius: "50%",
    background: "#ff0000",
    color: "#ffffff",
    fontSize: "24px",
    cursor: "grab",
    zIndex: "2147483647",
    boxShadow: "0 4px 12px rgba(0,0,0,.3)",
    userSelect: "none",
    transition: "transform .2s",
  });

  button.addEventListener("mouseenter", () => {
    button.style.transform = "scale(1.08)";
  });
  button.addEventListener("mouseleave", () => {
    button.style.transform = "scale(1)";
  });

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  button.addEventListener("mousedown", (e) => {
    dragging = true;
    offsetX = e.clientX - button.getBoundingClientRect().left;
    offsetY = e.clientY - button.getBoundingClientRect().top;
    button.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    button.style.left = `${e.clientX - offsetX}px`;
    button.style.top = `${e.clientY - offsetY}px`;
    button.style.right = "auto";
  });

  document.addEventListener("mouseup", () => {
    dragging = false;
    button.style.cursor = "grab";
  });

  button.addEventListener("click", captureVideoFrame);
}

function getVideoId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("v") || "";
}

function formatTime(seconds) {
  seconds = Math.floor(seconds);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// JPEG @ 0.85 quality instead of PNG — cuts screenshot size roughly
// 60-80%, which matters a lot once a video has 100+ screenshots and
// they all get embedded into one PDF.
function captureFrameAsDataURL(video) {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

// Wraps chrome.runtime.sendMessage in a Promise and rejects on
// background/db errors so callers can use plain try/catch.
function sendToBackground(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response || !response.success) {
        reject(new Error(response?.error || "Unknown background error"));
        return;
      }
      resolve(response.data);
    });
  });
}

async function captureVideoFrame() {
  const video = document.querySelector("video");
  if (!video) {
    showToast("❌ No video found");
    return;
  }

  try {
    const image = captureFrameAsDataURL(video);
    const now = Date.now();
    const screenshot = {
      id: crypto.randomUUID(),
      image,
      timestamp: formatTime(video.currentTime),
      title: document.title,
      videoId: getVideoId(),
      createdAt: now,
      order: now,
      note: "",
    };

    await sendToBackground("SAVE_SCREENSHOT", screenshot);
    showToast("✅ Screenshot Saved");
  } catch (error) {
    console.error("[LectureSnap] Failed to save screenshot:", error);
    showToast("❌ Failed to save screenshot");
  }
}

createFloatingButton();
