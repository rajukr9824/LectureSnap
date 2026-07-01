// background/background.js
// Owns the database. This is the ONLY place IndexedDB is touched.
// Content scripts and the popup communicate exclusively through
// chrome.runtime messages.

import {
  addScreenshot,
  getAllScreenshots,
  getScreenshotsByVideo,
  getScreenshotById,
  patchScreenshot,
  deleteScreenshot,
  deleteScreenshotsByVideo,
  clearScreenshots,
} from "../database/db.js";

chrome.runtime.onInstalled.addListener(() => {
  console.log("LectureSnap Installed");
});

const handlers = {
  async SAVE_SCREENSHOT(payload) {
    return addScreenshot(payload);
  },
  async GET_ALL_SCREENSHOTS() {
    return getAllScreenshots();
  },
  async GET_SCREENSHOTS_BY_VIDEO(payload) {
    return getScreenshotsByVideo(payload.videoId);
  },
  async GET_SCREENSHOT(payload) {
    return getScreenshotById(payload.id);
  },
  async UPDATE_SCREENSHOT(payload) {
    // payload: { id, fields } — partial patch (note, order, etc.)
    return patchScreenshot(payload.id, payload.fields);
  },
  async DELETE_SCREENSHOT(payload) {
    return deleteScreenshot(payload.id);
  },
  async DELETE_SCREENSHOTS_BY_VIDEO(payload) {
    return deleteScreenshotsByVideo(payload.videoId);
  },
  async CLEAR_SCREENSHOTS() {
    return clearScreenshots();
  },
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = handlers[message?.type];

  if (!handler) {
    sendResponse({
      success: false,
      error: `Unknown message type: ${message?.type}`,
    });
    return false;
  }

  handler(message.payload)
    .then((data) => sendResponse({ success: true, data }))
    .catch((error) => {
      console.error(`[LectureSnap] "${message.type}" failed:`, error);
      sendResponse({ success: false, error: error?.message || String(error) });
    });

  return true; // keep the message channel open for the async response
});
