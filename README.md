# 📚 LectureSnap

LectureSnap is a Chrome Extension that helps students and learners capture timestamped screenshots while watching YouTube lectures, organize them with notes, and generate PDF study notes.

---

# ✨ Features

* 📸 Capture screenshots directly from YouTube videos
* ⏱ Automatically save the video timestamp
* 📝 Add personal notes for every screenshot
* 🗂 Organize screenshots using drag & drop
* 🗑 Delete individual screenshots
* 🗑 Delete all screenshots of the current video
* 📄 Generate well-formatted PDF notes
* 💾 Store screenshots locally using IndexedDB
* 🎯 Filter screenshots for the currently opened YouTube video
* 🚀 Fast, lightweight, and works completely offline

---

# 🛠 Tech Stack

* JavaScript (ES6)
* HTML5
* CSS3
* Chrome Extension Manifest V3
* IndexedDB
* jsPDF
* SortableJS

---

# 📂 Project Structure

```
LectureSnap/
│
├── assets/
├── background/
│   └── background.js
│
├── content/
│   └── content.js
│
├── database/
│   └── db.js
│
├── libs/
│   ├── jspdf.umd.min.js
│   └── Sortable.min.js
│
 popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├──storage/
|     ├── storage.js
├── manifest.json
└── README.md
```

---

# 🚀 Installation

### Step 1

Download or clone this repository.

```
git clone https://github.com/<your-username>/LectureSnap.git
```

or download the ZIP and extract it.

---

### Step 2

Open Google Chrome.

---

### Step 3

Go to

```
chrome://extensions/
```

---

### Step 4

Enable **Developer Mode** from the top-right corner.

---

### Step 5

Click

```
Load unpacked
```

---

### Step 6

Select the extracted **LectureSnap** project folder.

The extension is now installed.

---

# 📖 How to Use

### 1. Open YouTube

Open any YouTube lecture or educational video.

Example:

```
https://www.youtube.com/watch?v=...
```

---

### 2. Capture Screenshot

A floating **📸** button will appear on the video page.

Click the button whenever you want to capture an important slide or moment.

LectureSnap automatically stores:

* Screenshot
* Timestamp
* Video Title
* Video ID

---

### 3. Open Extension

Click the LectureSnap extension icon.

The popup displays:

* Total screenshots
* Screenshot gallery
* Notes section

---

### 4. Add Notes

Write notes below every screenshot.

Notes are saved automatically.

---

### 5. Rearrange Screenshots

Drag and drop screenshots to change their order.

The updated order is preserved.

---

### 6. Delete Screenshot

Click the **🗑 Delete** button below any screenshot.

---

### 7. Delete All

Click **🗑 Delete All** to remove all screenshots belonging to the current YouTube video.

---

### 8. Generate PDF

Click

```
📄 Generate PDF
```

The generated PDF contains:

* Screenshot
* Timestamp
* Notes
* Video Title

---

# 💾 Data Storage

LectureSnap stores all screenshots locally using **IndexedDB**.

No screenshots or notes are uploaded to any server.

All data remains on your local machine.

---

# 🔒 Permissions

The extension requires the following permissions:

* activeTab
* tabs
* storage

Host Permission:

```
https://www.youtube.com/*
```

---

# 📦 Dependencies

* jsPDF
* SortableJS

---

# 🌟 Future Improvements

* Image compression
* Cloud synchronization
* Search notes
* Multiple PDF themes
* Dark Mode
* Export to Markdown
* Keyboard shortcuts

---

# 👨‍💻 Author

**Raju Kumar**

GitHub: https://github.com/rajukr9824

---

# 📄 License

This project is developed for educational and learning purposes.
