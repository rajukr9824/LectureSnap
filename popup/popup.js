// popup/popup.js
// Talks ONLY to background.js. No IndexedDB access here.

document.addEventListener("DOMContentLoaded", () => {
  const status = document.getElementById("status");
  const totalScreenshots = document.getElementById("totalScreenshots");
  const gallery = document.getElementById("gallery");
  const emptyState = document.getElementById("emptyState");
  const generatePdfBtn = document.getElementById("generatePdfBtn");
  const deleteAllBtn = document.getElementById("deleteAllBtn");

  let currentVideoId = "";
  let sortable = null;
  const noteDebounceTimers = {};

  // ----------------------------------------------------------------
  // Messaging helper
  // ----------------------------------------------------------------
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

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function setEmptyState(isEmpty) {
    emptyState.style.display = isEmpty ? "block" : "none";
    generatePdfBtn.disabled = isEmpty;
    deleteAllBtn.disabled = isEmpty;
  }

  function buildCard(shot, index) {
    const card = document.createElement("div");
    card.className = "screenshot-card";
    card.dataset.id = shot.id;
    card.innerHTML = `
      <img src="${shot.image}" alt="Screenshot ${index + 1}">
      <div class="screenshot-info">
        <span class="timestamp">⏱ ${shot.timestamp}</span>
        <span>#${index + 1}</span>
      </div>
      <div class="video-title">${escapeHtml(shot.title)}</div>
      <textarea
        class="note-input"
        data-id="${shot.id}"
        placeholder="Write your notes here..."
      >${escapeHtml(shot.note || "")}</textarea>
      <button class="delete-btn" data-id="${shot.id}">🗑 Delete</button>
    `;
    return card;
  }

  function attachCardEvents() {
    gallery.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await sendToBackground("DELETE_SCREENSHOT", { id: btn.dataset.id });
          await loadGallery();
        } catch (error) {
          console.error("[LectureSnap] Delete failed:", error);
          btn.disabled = false;
        }
      });
    });

    gallery.querySelectorAll(".note-input").forEach((textarea) => {
      textarea.addEventListener("input", () => {
        const id = textarea.dataset.id;
        clearTimeout(noteDebounceTimers[id]);
        noteDebounceTimers[id] = setTimeout(async () => {
          try {
            await sendToBackground("UPDATE_SCREENSHOT", {
              id,
              fields: { note: textarea.value },
            });
          } catch (error) {
            console.error("[LectureSnap] Note save failed:", error);
          }
        }, 500);
      });
    });
  }

  function setupSortable() {
    if (sortable) {
      sortable.destroy();
      sortable = null;
    }

    sortable = new Sortable(gallery, {
      animation: 200,
      ghostClass: "dragging",
      chosenClass: "drag-selected",
      dragClass: "dragging",
      forceFallback: true,
      onEnd: async () => {
        const ids = Array.from(gallery.children).map((card) => card.dataset.id);
        try {
          await Promise.all(
            ids.map((id, index) =>
              sendToBackground("UPDATE_SCREENSHOT", {
                id,
                fields: { order: index },
              }),
            ),
          );
        } catch (error) {
          console.error("[LectureSnap] Reorder failed:", error);
        }
        await loadGallery();
      },
    });
  }

  function renderGallery(screenshots) {
    gallery.innerHTML = "";
    totalScreenshots.textContent = screenshots.length;

    if (screenshots.length === 0) {
      setEmptyState(true);
      return;
    }
    setEmptyState(false);

    const fragment = document.createDocumentFragment();
    screenshots.forEach((shot, index) =>
      fragment.appendChild(buildCard(shot, index)),
    );
    gallery.appendChild(fragment);

    attachCardEvents();
    setupSortable();
  }

  async function loadGallery() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.url || !tab.url.includes("youtube.com/watch")) {
      status.textContent = "❌ Open a YouTube video.";
      currentVideoId = "";
      gallery.innerHTML = "";
      totalScreenshots.textContent = "0";
      setEmptyState(true);
      return;
    }

    status.textContent = "✅ YouTube video detected.";
    const url = new URL(tab.url);
    currentVideoId = url.searchParams.get("v") || "";

    try {
      const screenshots = await sendToBackground("GET_SCREENSHOTS_BY_VIDEO", {
        videoId: currentVideoId,
      });
      renderGallery(screenshots);
    } catch (error) {
      console.error("[LectureSnap] Failed to load screenshots:", error);
      status.textContent = "❌ Failed to load screenshots.";
    }
  }

  // ----------------------------------------------------------------
  // Delete All — current video only
  // ----------------------------------------------------------------
  deleteAllBtn.addEventListener("click", async () => {
    if (!currentVideoId) return;
    const confirmed = confirm("Delete all screenshots for this video?");
    if (!confirmed) return;

    deleteAllBtn.disabled = true;
    try {
      await sendToBackground("DELETE_SCREENSHOTS_BY_VIDEO", {
        videoId: currentVideoId,
      });
      await loadGallery();
    } catch (error) {
      console.error("[LectureSnap] Delete all failed:", error);
      deleteAllBtn.disabled = false;
    }
  });

  // ----------------------------------------------------------------
  // PDF generation — yields between screenshots so 100+ page PDFs
  // don't freeze the popup, and uses JPEG + "MEDIUM" compression to
  // keep file size manageable.
  // ----------------------------------------------------------------
  async function generatePDF() {
    generatePdfBtn.disabled = true;
    const originalLabel = generatePdfBtn.textContent;
    generatePdfBtn.textContent = "⏳ Generating...";

    try {
      const { jsPDF } = window.jspdf;
      const screenshots = await sendToBackground("GET_SCREENSHOTS_BY_VIDEO", {
        videoId: currentVideoId,
      });

      if (screenshots.length === 0) {
        alert("No screenshots found.");
        return;
      }

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageHeight = pdf.internal.pageSize.getHeight();
      let y = 20;

      pdf.setFontSize(22);
      pdf.text("LectureSnap Notes", 20, y);
      y += 10;
      pdf.setFontSize(12);
      pdf.text(`Video: ${screenshots[0].title}`, 20, y);
      y += 8;
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, y);
      y += 8;
      pdf.text(`Total Screenshots: ${screenshots.length}`, 20, y);
      y += 15;

      const imageHeight = 95;
      const YIELD_EVERY = 10;

      for (let i = 0; i < screenshots.length; i++) {
        const shot = screenshots[i];
        const notes = shot.note && shot.note.trim() ? shot.note : "No Notes";
        const wrappedNotes = pdf.splitTextToSize(notes, 170);
        const noteHeight = wrappedNotes.length * 6;
        const requiredHeight = 8 + 8 + imageHeight + 8 + noteHeight + 15;

        if (y + requiredHeight > pageHeight - 15) {
          pdf.addPage();
          y = 20;
        }

        pdf.setDrawColor(180);
        pdf.line(15, y - 5, 195, y - 5);

        pdf.setFontSize(14);
        pdf.text(`Screenshot ${i + 1}`, 20, y);
        y += 8;

        pdf.setFontSize(11);
        pdf.text(`Timestamp : ${shot.timestamp}`, 20, y);
        y += 8;

        try {
          pdf.addImage(
            shot.image,
            "JPEG",
            20,
            y,
            170,
            imageHeight,
            undefined,
            "MEDIUM",
          );
          y += imageHeight + 10;
        } catch (error) {
          console.error("[LectureSnap] Failed to embed image:", error);
          pdf.text("Unable to load image.", 20, y);
          y += 15;
        }

        pdf.setFontSize(12);
        pdf.text("Notes:", 20, y);
        y += 8;
        pdf.text(wrappedNotes, 20, y);
        y += wrappedNotes.length * 6 + 12;

        if (i % YIELD_EVERY === 0) {
          // Let the browser breathe so the popup stays responsive
          // during very large exports.
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      const fileName = screenshots[0].title
        .replace(/[\\/:*?"<>|]/g, "")
        .substring(0, 50);
      pdf.save(`${fileName || "LectureSnap"}.pdf`);
    } catch (error) {
      console.error("[LectureSnap] PDF generation failed:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      generatePdfBtn.disabled = false;
      generatePdfBtn.textContent = originalLabel;
    }
  }

  generatePdfBtn.addEventListener("click", generatePDF);
  loadGallery();
});
