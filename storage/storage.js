const STORAGE_KEY = "lectureSnapData";

/**
 * Get all stored data
 */
async function getAllData() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || {};
}

/**
 * Save all data
 */
async function saveAllData(data) {
  await chrome.storage.local.set({
    [STORAGE_KEY]: data,
  });
}

/**
 * Save screenshot for one video
 */
async function saveScreenshot(videoId, screenshot) {
  const data = await getAllData();

  if (!data[videoId]) {
    data[videoId] = [];
  }

  data[videoId].push(screenshot);

  await saveAllData(data);
}

/**
 * Get screenshots for one video
 */
async function getScreenshots(videoId) {
  const data = await getAllData();

  return data[videoId] || [];
}

/**
 * Delete screenshot
 */
async function deleteScreenshot(videoId, screenshotId) {
  const data = await getAllData();

  if (!data[videoId]) return;

  data[videoId] = data[videoId].filter((item) => item.id !== screenshotId);

  await saveAllData(data);
}
