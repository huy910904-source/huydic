import React, { useState, useRef, useCallback, useEffect } from "react";

// --- BỘ LỌC TỪ VIẾT TẮT THÔNG MINH (NHẬN DIỆN KHÔNG DẤU ') ---
const expandContractions = (str) => {
  let s = str?.toLowerCase() || "";
  const map = {
    "i'm": "i am",
    im: "i am",
    "can't": "cannot",
    cant: "cannot",
    "won't": "will not",
    wont: "will not",
    "don't": "do not",
    dont: "do not",
    "doesn't": "does not",
    doesnt: "does not",
    "didn't": "did not",
    didnt: "did not",
    "isn't": "is not",
    isnt: "is not",
    "aren't": "are not",
    arent: "are not",
    "haven't": "have not",
    havent: "have not",
    "hasn't": "has not",
    hasnt: "has not",
    "it's": "it is",
    its: "it is",
    "that's": "that is",
    thats: "that is",
    "there's": "there is",
    theres: "there is",
    "what's": "what is",
    whats: "what is",
    "he's": "he is",
    hes: "he is",
    "she's": "she is",
    shes: "she is",
    "you're": "you are",
    youre: "you are",
    "we're": "we are",
    "they're": "they are",
    theyre: "they are",
    "i've": "i have",
    ive: "i have",
    "you've": "you have",
    youve: "you have",
    "we've": "we have",
    weve: "we have",
    "they've": "they have",
    theyve: "they have",
    "i'll": "i will",
    ill: "i will",
    "you'll": "you will",
    youll: "you will",
    "we'll": "we will",
    "they'll": "they will",
    theyll: "they will",
    "i'd": "i would",
    id: "i would",
    "you'd": "you would",
    youd: "you would",
    "he'd": "he would",
    hed: "he would",
    "she'd": "she would",
    shed: "she would",
    "we'd": "we would",
    wed: "we would",
    "they'd": "they would",
    theyd: "they would",
  };
  for (const [key, val] of Object.entries(map)) {
    s = s.replace(new RegExp(`\\b${key}\\b`, "g"), val);
  }
  return s
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const normalize = (str) => expandContractions(str);

// ==========================================
// KÉT SẮT BÍ MẬT: LƯU TRỮ FILE AUDIO VĨNH VIỄN
// ==========================================
const audioDB = {
  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("DictationAudioDB", 1);
      request.onupgradeneeded = (e) =>
        e.target.result.createObjectStore("audios");
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },
  async save(id, blob) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("audios", "readwrite");
      tx.objectStore("audios").put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async get(id) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("audios", "readonly");
      const request = tx.objectStore("audios").get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  async delete(id) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("audios", "readwrite");
      tx.objectStore("audios").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

export default function App() {
  // --- STATE HỆ THỐNG ---
  const [library, setLibrary] = useState([]);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [sessionAudioUrls, setSessionAudioUrls] = useState({});
  const [newAudioFile, setNewAudioFile] = useState(null);
  const [newJsonData, setNewJsonData] = useState(null);
  const [newFileName, setNewFileName] = useState("");
  const [isDBLoading, setIsDBLoading] = useState(true);

  // --- STATE HỌC TẬP & DICTATION ---
  const [input, setInput] = useState("");
  const [attemptsPerWord, setAttemptsPerWord] = useState({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState("LIBRARY");

  // --- STATE LƯU GOOGLE SHEETS ---
  const [isSavingSheet, setIsSavingSheet] = useState(false);

  // --- TÍNH NĂNG MỚI: TÙY CHỈNH ĐOẠN & FULL SCRIPT ---
  const [errorLog, setErrorLog] = useState([]);
  const [reviewHardMode, setReviewMode] = useState(false);
  const [savedSentences, setSavedSentences] = useState([]);

  // --- AUDIO CONTROLS & REFS ---
  const [isShaking, setIsShaking] = useState(false);
  const [keyForAnimation, setKeyForAnimation] = useState(0);
  const [customStartIdx, setCustomStartIdx] = useState(0);
  const [customEndIdx, setCustomEndIdx] = useState(0);
  const [showFullScript, setShowFullScript] = useState(false);
  const [currentPlayingIdx, setCurrentPlayingIdx] = useState(-1);

  // --- TÍNH NĂNG ĐỆM AUDIO (PRE-ROLL) ---
  const [usePreRoll, setUsePreRoll] = useState(true);

  const [playbackRate, setPlaybackRate] = useState(1);
  const [isAutoLoop, setIsAutoLoop] = useState(false);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const resultBoxRef = useRef(null);
  const isTransitioning = useRef(false);
  const autoPlayRef = useRef(false);

  // --- SỔ TỪ VỰNG ---
  const [vocabList, setVocabList] = useState([]);
  const [newVocab, setNewVocab] = useState({
    word: "",
    meaning: "",
    example: "",
  });

  // KHỞI TẠO VÀ LƯU TRỮ
  useEffect(() => {
    const loadSavedData = async () => {
      const savedVocab = localStorage.getItem("my_vocab_book");
      if (savedVocab) setVocabList(JSON.parse(savedVocab));

      const savedErrors = localStorage.getItem("my_error_log");
      if (savedErrors) setErrorLog(JSON.parse(savedErrors));

      const savedFavs = localStorage.getItem("my_saved_sentences");
      if (savedFavs) setSavedSentences(JSON.parse(savedFavs));

      const savedLibrary = localStorage.getItem("my_dictation_library");
      if (savedLibrary) {
        const parsedLib = JSON.parse(savedLibrary);
        setLibrary(parsedLib);
        const loadedUrls = {};
        for (const lesson of parsedLib) {
          try {
            const audioBlob = await audioDB.get(lesson.id);
            if (audioBlob)
              loadedUrls[lesson.id] = URL.createObjectURL(audioBlob);
          } catch (err) {}
        }
        setSessionAudioUrls(loadedUrls);
      }
      setIsDBLoading(false);
    };
    loadSavedData();
  }, []);

  useEffect(
    () => localStorage.setItem("my_vocab_book", JSON.stringify(vocabList)),
    [vocabList]
  );
  useEffect(
    () => localStorage.setItem("my_dictation_library", JSON.stringify(library)),
    [library]
  );
  useEffect(
    () => localStorage.setItem("my_error_log", JSON.stringify(errorLog)),
    [errorLog]
  );
  useEffect(
    () =>
      localStorage.setItem(
        "my_saved_sentences",
        JSON.stringify(savedSentences)
      ),
    [savedSentences]
  );

  useEffect(() => {
    if (showFeedback && resultBoxRef.current)
      resultBoxRef.current.scrollTop = resultBoxRef.current.scrollHeight;
  }, [input, showFeedback]);

  useEffect(() => {
    if (showFullScript && currentPlayingIdx !== -1) {
      const el = document.getElementById(`script-line-${currentPlayingIdx}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentPlayingIdx, showFullScript]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const activeLesson = library.find((l) => l.id === activeLessonId);
  const currentSegment = activeLesson
    ? activeLesson.data[activeLesson.currentIdx]
    : null;
  const currentAudioUrl = sessionAudioUrls[activeLessonId];

  const hardSentencesInCurrentLesson = [
    ...new Set(
      errorLog
        .filter((e) => e.lessonId === activeLessonId)
        .map((e) => e.sentenceIdx)
    ),
  ].sort((a, b) => a - b);
  const currentSentenceId = activeLesson
    ? `${activeLesson.id}_${activeLesson.currentIdx}`
    : "";
  const isCurrentSaved = savedSentences.some((s) => s.id === currentSentenceId);

  useEffect(() => {
    if (activeLesson) {
      setCustomStartIdx(0);
      setCustomEndIdx(activeLesson.currentIdx);
    }
  }, [activeLessonId, activeLesson?.currentIdx]);

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);
  };

  // AUTO-CHECK
  useEffect(() => {
    if (!currentSegment || !input.trim()) return;
    const transcriptStr = normalize(currentSegment.transcript);
    const userStr = normalize(input);

    if (transcriptStr === userStr) {
      setIsSuccess(true);
      setShowFeedback(true);
      if (audioRef.current) audioRef.current.pause();
    }
  }, [input, currentSegment]);

  // ==========================================
  // HÀM LƯU LÊN GOOGLE SHEETS
  // ==========================================
  const handleSaveToSheet = async () => {
    const GOOGLE_APP_SCRIPT_URL =
      "https://script.google.com/macros/s/AKfycbyMaPFuhHb0aASnM6TWnmF6nH2nr83shO15M5W6wkjaUeJsVAf-Fz7Wj3TgMRpCCERSWA/exec";

    if (!currentSegment) return;

    setIsSavingSheet(true);
    try {
      await fetch(GOOGLE_APP_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vietnamese: currentSegment.translation, // Cột A
          english: currentSegment.transcript, // Cột B
        }),
      });
      triggerShake();
      alert("✅ Đã lưu câu này lên Google Sheets!");
    } catch (error) {
      alert("❌ Có lỗi xảy ra khi lưu vào Sheets.");
    }
    setIsSavingSheet(false);
  };

  // ==========================================
  // PHÁT AUDIO NGỮ CẢNH (CẬP NHẬT ĐỆM 3 GIÂY)
  // ==========================================
  const playRange = useCallback(
    (startIdx, endIdx) => {
      if (!audioRef.current || !activeLesson) return;
      const safeStartIdx = Math.min(startIdx, endIdx);
      const safeEndIdx = Math.max(startIdx, endIdx);
      const startSegment = activeLesson.data[safeStartIdx];
      const endSegment = activeLesson.data[safeEndIdx];
      if (!startSegment || !endSegment) return;

      // Xử lý đệm thời gian (Trừ 3s nếu bật tính năng)
      const offset = usePreRoll ? 3 : 0;
      const actualStartTime = Math.max(0, startSegment.start_time - offset);

      clearInterval(timerRef.current);
      audioRef.current.currentTime = actualStartTime;
      audioRef.current.play().catch((e) => console.log("Lỗi:", e));
      setCurrentPlayingIdx(safeStartIdx);

      timerRef.current = setInterval(() => {
        if (!audioRef.current || !activeLesson) return;
        const currentTime = audioRef.current.currentTime;
        const activeIdx = activeLesson.data.findIndex(
          (s) => currentTime >= s.start_time && currentTime <= s.end_time
        );
        if (activeIdx !== -1) setCurrentPlayingIdx(activeIdx);

        if (currentTime >= endSegment.end_time) {
          if (isAutoLoop && !isSuccess) {
            audioRef.current.currentTime = actualStartTime; // Lặp lại cũng bắt đầu từ chỗ đệm 3s
            audioRef.current.play();
          } else {
            audioRef.current.pause();
            clearInterval(timerRef.current);
            setCurrentPlayingIdx(-1);
          }
        }
      }, 100);
    },
    [activeLesson, isAutoLoop, isSuccess, usePreRoll]
  );

  const playSegment = useCallback(() => {
    if (activeLesson)
      playRange(activeLesson.currentIdx, activeLesson.currentIdx);
  }, [activeLesson, playRange]);

  const rewindAudio = () => {
    if (audioRef.current && currentSegment) {
      let newTime = audioRef.current.currentTime - 2;
      if (newTime < currentSegment.start_time)
        newTime = currentSegment.start_time;
      audioRef.current.currentTime = newTime;
    }
  };

  // ==========================================
  // GHI NHẬN LỖI SAI
  // ==========================================
  const logError = (targetWord, userWord) => {
    let errorType = "Sai từ";
    if (!userWord) {
      errorType = "Thiếu từ";
      userWord = "(Thiếu từ)";
    } else {
      const cleanTarget = normalize(targetWord);
      const cleanUser = normalize(userWord);
      if (
        cleanTarget.startsWith(cleanUser.substring(0, 3)) ||
        cleanUser.startsWith(cleanTarget.substring(0, 3))
      ) {
        errorType = "Sai chính tả";
      }
    }

    setErrorLog((prev) => {
      const newLog = [...prev];
      const existing = newLog.find(
        (e) =>
          e.lessonId === activeLessonId &&
          e.sentenceIdx === activeLesson.currentIdx &&
          e.targetWord === targetWord
      );
      if (existing) {
        existing.count += 1;
        existing.lastUserWord = userWord;
        existing.type = errorType;
      } else {
        newLog.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          lessonId: activeLessonId,
          lessonName: activeLesson.name,
          sentenceIdx: activeLesson.currentIdx,
          targetWord: targetWord,
          lastUserWord: userWord,
          type: errorType,
          count: 1,
          timestamp: Date.now(),
        });
      }
      return newLog;
    });
  };

  // ==========================================
  // CHUYỂN CÂU
  // ==========================================
  const resetDictationState = () => {
    setInput("");
    setAttemptsPerWord({});
    setShowFeedback(false);
    setIsSuccess(false);
  };

  const jumpToSentence = (newIdx) => {
    if (!activeLesson) return;
    setLibrary((prev) =>
      prev.map((lesson) =>
        lesson.id === activeLesson.id
          ? { ...lesson, currentIdx: newIdx }
          : lesson
      )
    );
    resetDictationState();
    setKeyForAnimation((prev) => prev + 1);
    autoPlayRef.current = true;
  };

  const reviewErrorSentence = (lessonId, sentenceIdx) => {
    setActiveLessonId(lessonId);
    setReviewMode(false);
    setLibrary((prev) =>
      prev.map((lesson) =>
        lesson.id === lessonId ? { ...lesson, currentIdx: sentenceIdx } : lesson
      )
    );
    resetDictationState();
    setActiveTab("DICTATION");
    setKeyForAnimation((prev) => prev + 1);
  };

  useEffect(() => {
    if (autoPlayRef.current && currentSegment) {
      autoPlayRef.current = false;
      const t = setTimeout(() => playSegment(), 300);
      return () => clearTimeout(t);
    }
  }, [currentSegment, playSegment]);

  const nextSentence = () => {
    if (isTransitioning.current) return;
    isTransitioning.current = true;

    let nextIdx = -1;
    if (reviewHardMode && hardSentencesInCurrentLesson.length > 0) {
      const currentHardIndex = hardSentencesInCurrentLesson.indexOf(
        activeLesson.currentIdx
      );
      if (
        currentHardIndex !== -1 &&
        currentHardIndex < hardSentencesInCurrentLesson.length - 1
      ) {
        nextIdx = hardSentencesInCurrentLesson[currentHardIndex + 1];
      } else if (currentHardIndex === -1) {
        nextIdx =
          hardSentencesInCurrentLesson.find(
            (idx) => idx > activeLesson.currentIdx
          ) ?? -1;
      }
    } else {
      if (activeLesson.currentIdx < activeLesson.data.length - 1)
        nextIdx = activeLesson.currentIdx + 1;
    }

    if (nextIdx !== -1) jumpToSentence(nextIdx);
    else
      alert(
        reviewHardMode
          ? "🎉 Tuyệt vời! Bạn đã ôn xong toàn bộ các câu khó!"
          : "🎉 Bạn đã hoàn thành toàn bộ bài nghe này!"
      );

    setTimeout(() => {
      isTransitioning.current = false;
    }, 500);
  };

  // ==========================================
  // HÀNH ĐỘNG KHÁC (UPLOAD, XÓA, LƯU CÂU)
  // ==========================================
  const handleNewAudioUpload = (e) => {
    if (e.target.files[0]) setNewAudioFile(e.target.files[0]);
  };
  const handleNewJsonUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewFileName(file.name.replace(".json", ""));
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          setNewJsonData(JSON.parse(event.target.result));
        } catch (error) {
          alert("Lỗi đọc JSON!");
        }
      };
      reader.readAsText(file);
    }
  };

  const createNewLesson = async () => {
    if (!newJsonData || !newAudioFile) return;
    const newId = Date.now().toString();
    const newLesson = {
      id: newId,
      name: newFileName || "Bài học mới",
      data: newJsonData,
      currentIdx: 0,
    };
    try {
      await audioDB.save(newId, newAudioFile);
    } catch (err) {
      alert("Lỗi khi lưu Audio!");
    }
    setLibrary((prev) => [newLesson, ...prev]);
    setSessionAudioUrls((prev) => ({
      ...prev,
      [newId]: URL.createObjectURL(newAudioFile),
    }));
    setNewJsonData(null);
    setNewAudioFile(null);
    setNewFileName("");
    setActiveLessonId(newId);
    setActiveTab("DICTATION");
    resetDictationState();
    setKeyForAnimation((prev) => prev + 1);
  };

  const deleteLesson = async (id) => {
    if (
      window.confirm("Xóa vĩnh viễn bài này và mọi dữ liệu thống kê liên quan?")
    ) {
      await audioDB.delete(id);
      setLibrary((prev) => prev.filter((l) => l.id !== id));
      setErrorLog((prev) => prev.filter((e) => e.lessonId !== id));
      setSavedSentences((prev) => prev.filter((s) => s.lessonId !== id));
      if (activeLessonId === id) {
        setActiveLessonId(null);
        setActiveTab("LIBRARY");
      }
    }
  };

  const toggleSaveSentence = () => {
    if (!activeLesson || !currentSegment) return;
    if (isCurrentSaved) {
      setSavedSentences((prev) =>
        prev.filter((s) => s.id !== currentSentenceId)
      );
    } else {
      setSavedSentences((prev) => [
        ...prev,
        {
          id: currentSentenceId,
          lessonId: activeLesson.id,
          lessonName: activeLesson.name,
          sentenceIdx: activeLesson.currentIdx,
          transcript: currentSegment.transcript,
          translation: currentSegment.translation,
        },
      ]);
    }
  };

  // BẢN VÁ: HÀM NHẢY CÂU TỪ TAB ĐÃ LƯU
  const playSavedSentence = (lessonId, sentenceIdx) => {
    if (!sessionAudioUrls[lessonId]) {
      alert("Cần nối lại Audio ở tab Thư Viện trước!");
      setActiveTab("LIBRARY");
      return;
    }

    setReviewMode(false); // Tắt chế độ ôn câu khó để không bị kẹt bộ lọc
    setActiveLessonId(lessonId);

    // Ép cập nhật lại thư viện để trỏ đúng vào câu muốn nghe
    setLibrary((prev) =>
      prev.map((lesson) =>
        lesson.id === lessonId ? { ...lesson, currentIdx: sentenceIdx } : lesson
      )
    );

    resetDictationState();
    setActiveTab("DICTATION");
    setKeyForAnimation((prev) => prev + 1);

    // Kích hoạt auto-play
    setTimeout(() => {
      autoPlayRef.current = true;
    }, 100);
  };

  // KIỂM TRA ĐÁP ÁN
  const handleCheck = () => {
    if (!input.trim() || !currentSegment) return;
    const transcriptStr = normalize(currentSegment.transcript);
    const userStr = normalize(input);
    if (transcriptStr === userStr) {
      setIsSuccess(true);
      setShowFeedback(true);
      if (audioRef.current) audioRef.current.pause();
      return;
    }
    const transcriptWords = transcriptStr.split(/\s+/).filter(Boolean);
    const userWords = userStr.split(/\s+/).filter(Boolean);
    const rawTranscriptWords = currentSegment.transcript
      .split(/\s+/)
      .filter(Boolean);
    let errorIdx = -1;
    for (let i = 0; i < transcriptWords.length; i++) {
      if (userWords[i] !== transcriptWords[i]) {
        errorIdx = i;
        break;
      }
    }
    if (errorIdx === -1 && userWords.length < transcriptWords.length)
      errorIdx = userWords.length;
    if (errorIdx !== -1) {
      setAttemptsPerWord((prev) => ({
        ...prev,
        [errorIdx]: (prev[errorIdx] || 0) + 1,
      }));
      logError(rawTranscriptWords[errorIdx], userWords[errorIdx]);
    }
    setIsSuccess(false);
    setShowFeedback(true);
    triggerShake();
  };

  const handleSurrenderWord = () => {
    const rawTranscriptWords = currentSegment.transcript
      .split(/\s+/)
      .filter(Boolean);
    const userWords = input.trim().split(/\s+/).filter(Boolean);
    let errorIdx = -1;
    for (let i = 0; i < rawTranscriptWords.length; i++) {
      if (normalize(userWords[i]) !== normalize(rawTranscriptWords[i])) {
        errorIdx = i;
        break;
      }
    }
    if (errorIdx === -1 && userWords.length < rawTranscriptWords.length)
      errorIdx = userWords.length;
    if (errorIdx !== -1) {
      const correctWord = rawTranscriptWords[errorIdx].replace(
        /[^a-zA-Z0-9'’]/g,
        ""
      );
      const newInputArray = userWords.slice(0, errorIdx);
      newInputArray.push(correctWord);
      setInput(newInputArray.join(" ") + " ");
      logError(rawTranscriptWords[errorIdx], userWords[errorIdx]);
      triggerShake();
      setTimeout(() => handleCheck(), 100);
    }
  };

  const saveVocab = () => {
    if (!newVocab.word) return;
    setVocabList([{ ...newVocab, id: Date.now() }, ...vocabList]);
    setNewVocab({ word: "", meaning: "", example: "" });
  };
  const deleteVocab = (id) =>
    setVocabList(vocabList.filter((v) => v.id !== id));

  if (isDBLoading)
    return (
      <div style={{ color: "white", textAlign: "center", marginTop: "50px" }}>
        Đang tải dữ liệu từ máy...
      </div>
    );

  return (
    <div
      className="animated-bg"
      style={{
        minHeight: "100vh",
        color: "#e2e8f0",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <style>{`
        .animated-bg { background: linear-gradient(-45deg, #0f172a, #1e293b, #111827, #1e1b4b); background-size: 400% 400%; animation: gradientMove 15s ease infinite; }
        .fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .pop-in { animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .shake-anim { animation: shake 0.4s ease-in-out; }
        .pulse-btn { animation: pulseGlow 1.5s infinite; }
        .floating { animation: floatAnim 3s ease-in-out infinite; }
        .btn-hover { transition: all 0.2s ease; }
        .btn-hover:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(0, 0, 0, 0.2); filter: brightness(1.1); }
        .btn-hover:active { transform: translateY(1px); }
        @keyframes gradientMove { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 50% { transform: scale(1.02); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-5px); } 40%, 80% { transform: translateX(5px); } }
        @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); } 70% { box-shadow: 0 0 0 12px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
        @keyframes floatAnim { 0% { transform: translateY(0px); } 50% { transform: translateY(-6px); text-shadow: 0 10px 15px rgba(34, 197, 94, 0.3); } 100% { transform: translateY(0px); } }
        .glass-panel { background: rgba(30, 41, 59, 0.85); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .error-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .error-table th, .error-table td { padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .error-table th { background: rgba(0,0,0,0.3); color: #38bdf8; font-weight: bold; }
        .error-table tr:hover { background: rgba(255,255,255,0.05); }
      `}</style>

      <div style={{ padding: "20px", maxWidth: "1100px", margin: "0 auto" }}>
        {/* TABS HEADER CHÍNH */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            borderBottom: "2px solid rgba(255,255,255,0.1)",
            paddingBottom: "15px",
            marginBottom: "25px",
          }}
        >
          <button
            className="btn-hover"
            onClick={() => setActiveTab("LIBRARY")}
            style={{
              flex: 1,
              minWidth: "120px",
              padding: "12px",
              fontSize: "16px",
              fontWeight: "bold",
              background:
                activeTab === "LIBRARY" ? "#10b981" : "rgba(255,255,255,0.05)",
              color: activeTab === "LIBRARY" ? "#0f172a" : "#94a3b8",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            📚 Thư Viện
          </button>
          <button
            className="btn-hover"
            onClick={() => {
              if (activeLessonId) {
                setActiveTab("DICTATION");
                setKeyForAnimation((prev) => prev + 1);
              } else alert("Chọn bài học trước!");
            }}
            style={{
              flex: 1,
              minWidth: "120px",
              padding: "12px",
              fontSize: "16px",
              fontWeight: "bold",
              background:
                activeTab === "DICTATION"
                  ? "#38bdf8"
                  : "rgba(255,255,255,0.05)",
              color: activeTab === "DICTATION" ? "#0f172a" : "#94a3b8",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              cursor: "pointer",
              opacity: activeLessonId ? 1 : 0.5,
            }}
          >
            🎧 Luyện Nghe
          </button>
          <button
            className="btn-hover"
            onClick={() => setActiveTab("STATS")}
            style={{
              flex: 1,
              minWidth: "120px",
              padding: "12px",
              fontSize: "16px",
              fontWeight: "bold",
              background:
                activeTab === "STATS" ? "#ef4444" : "rgba(255,255,255,0.05)",
              color: activeTab === "STATS" ? "#fff" : "#94a3b8",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            📊 Lỗi ({errorLog.length})
          </button>
          <button
            className="btn-hover"
            onClick={() => setActiveTab("SAVED")}
            style={{
              flex: 1,
              minWidth: "120px",
              padding: "12px",
              fontSize: "16px",
              fontWeight: "bold",
              background:
                activeTab === "SAVED" ? "#f59e0b" : "rgba(255,255,255,0.05)",
              color: activeTab === "SAVED" ? "#fff" : "#94a3b8",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            ⭐ Đã Lưu ({savedSentences.length})
          </button>
          <button
            className="btn-hover"
            onClick={() => setActiveTab("VOCAB")}
            style={{
              flex: 1,
              minWidth: "120px",
              padding: "12px",
              fontSize: "16px",
              fontWeight: "bold",
              background:
                activeTab === "VOCAB" ? "#a855f7" : "rgba(255,255,255,0.05)",
              color: activeTab === "VOCAB" ? "#fff" : "#94a3b8",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            📖 Sổ Từ
          </button>
        </div>

        {/* ================= TAB 1: THƯ VIỆN ================= */}
        {activeTab === "LIBRARY" && (
          <div className="fade-in">
            <div
              className="glass-panel"
              style={{
                padding: "25px",
                borderRadius: "16px",
                marginBottom: "30px",
                border: "2px dashed rgba(56, 189, 248, 0.4)",
              }}
            >
              <h3
                style={{
                  color: "#38bdf8",
                  marginTop: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                ➕ Thêm Bài Học Mới
              </h3>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "20px",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "14px",
                      color: "#cbd5e1",
                    }}
                  >
                    1. Tải lên Audio (.mp3)
                  </p>
                  <input
                    type="file"
                    accept=".mp3, .wav, audio/*"
                    onChange={handleNewAudioUpload}
                    style={{
                      color: "#fff",
                      width: "100%",
                      padding: "10px",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "8px",
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "14px",
                      color: "#cbd5e1",
                    }}
                  >
                    2. Tải lên Script (.json)
                  </p>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleNewJsonUpload}
                    style={{
                      color: "#fff",
                      width: "100%",
                      padding: "10px",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "8px",
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "14px",
                      color: "#cbd5e1",
                    }}
                  >
                    3. Tên bài học (Tùy chỉnh)
                  </p>
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="Nhập tên dễ nhớ..."
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(0,0,0,0.2)",
                      color: "#fff",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
              <button
                className="btn-hover"
                onClick={createNewLesson}
                disabled={!newJsonData || !newAudioFile}
                style={{
                  marginTop: "20px",
                  padding: "14px 24px",
                  background:
                    !newJsonData || !newAudioFile
                      ? "rgba(255,255,255,0.1)"
                      : "linear-gradient(135deg, #10b981, #059669)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: "bold",
                  fontSize: "16px",
                  cursor:
                    !newJsonData || !newAudioFile ? "not-allowed" : "pointer",
                  width: "100%",
                }}
              >
                Tạo và Học Ngay 🚀
              </button>
            </div>

            <h3 style={{ color: "#f8fafc", marginBottom: "20px" }}>
              📂 Các bài học đang theo dõi
            </h3>
            {library.length === 0 ? (
              <p
                style={{
                  color: "#64748b",
                  fontStyle: "italic",
                  textAlign: "center",
                }}
              >
                Thư viện trống.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "15px",
                }}
              >
                {library.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="glass-panel"
                    style={{
                      padding: "20px",
                      borderRadius: "16px",
                      borderLeft: "5px solid #38bdf8",
                      position: "relative",
                    }}
                  >
                    <button
                      className="btn-hover"
                      onClick={() => deleteLesson(lesson.id)}
                      style={{
                        position: "absolute",
                        top: "20px",
                        right: "20px",
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#ef4444",
                        borderRadius: "8px",
                        padding: "6px 12px",
                        fontSize: "14px",
                        cursor: "pointer",
                      }}
                    >
                      🗑 Xóa
                    </button>
                    <h3
                      style={{
                        margin: "0 0 12px 0",
                        color: "#f8fafc",
                        fontSize: "20px",
                        paddingRight: "60px",
                      }}
                    >
                      {lesson.name}
                    </h3>
                    <div
                      style={{
                        background: "rgba(0,0,0,0.3)",
                        borderRadius: "10px",
                        height: "10px",
                        overflow: "hidden",
                        marginBottom: "12px",
                        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
                      }}
                    >
                      <div
                        style={{
                          width: `${
                            (lesson.currentIdx / lesson.data.length) * 100
                          }%`,
                          height: "100%",
                          background:
                            "linear-gradient(90deg, #38bdf8, #818cf8)",
                          transition: "width 0.5s ease",
                        }}
                      ></div>
                    </div>
                    <p
                      style={{
                        margin: "0 0 15px 0",
                        fontSize: "14px",
                        color: "#94a3b8",
                      }}
                    >
                      Tiến độ:{" "}
                      <strong style={{ color: "#fff" }}>
                        Câu {lesson.currentIdx + 1}
                      </strong>{" "}
                      / {lesson.data.length}
                    </p>
                    {sessionAudioUrls[lesson.id] ? (
                      <button
                        className="btn-hover"
                        onClick={() => {
                          setActiveLessonId(lesson.id);
                          setActiveTab("DICTATION");
                          resetDictationState();
                          setKeyForAnimation((prev) => prev + 1);
                        }}
                        style={{
                          padding: "10px 24px",
                          background:
                            "linear-gradient(135deg, #3b82f6, #2563eb)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "8px",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        ▶ Tiếp tục học
                      </button>
                    ) : (
                      <div
                        style={{
                          background: "rgba(239, 68, 68, 0.1)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          padding: "12px",
                          borderRadius: "10px",
                        }}
                      >
                        <p
                          style={{
                            margin: "0 0 8px 0",
                            fontSize: "13px",
                            color: "#fca5a5",
                          }}
                        >
                          ⚠ Cần nối lại MP3:
                        </p>
                        <input
                          type="file"
                          accept=".mp3, .wav, audio/*"
                          onChange={async (e) => {
                            if (e.target.files[0]) {
                              await audioDB.save(lesson.id, e.target.files[0]);
                              setSessionAudioUrls((prev) => ({
                                ...prev,
                                [lesson.id]: URL.createObjectURL(
                                  e.target.files[0]
                                ),
                              }));
                            }
                          }}
                          style={{ color: "#fff", fontSize: "13px" }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: LUYỆN NGHE & FULL SCRIPT ================= */}
        {activeTab === "DICTATION" && activeLesson && (
          <div
            key={keyForAnimation}
            className="fade-in"
            style={{ display: "flex", gap: "20px", flexDirection: "column" }}
          >
            <audio ref={audioRef} src={currentAudioUrl} />

            {/* HÀNG HEADER */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "5px",
              }}
            >
              <span
                style={{
                  fontSize: "20px",
                  color: "#f8fafc",
                  fontWeight: "bold",
                  textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                }}
              >
                {activeLesson.name}
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "rgba(0,0,0,0.2)",
                  padding: "5px 15px",
                  borderRadius: "20px",
                }}
              >
                <span style={{ fontSize: "15px", color: "#cbd5e1" }}>
                  Đang ở câu
                </span>

                {/* DROPDOWN CHỌN CÂU */}
                <select
                  className="btn-hover"
                  value={activeLesson.currentIdx}
                  onChange={(e) => jumpToSentence(parseInt(e.target.value, 10))}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    background: reviewHardMode
                      ? "rgba(239, 68, 68, 0.2)"
                      : "rgba(255,255,255,0.1)",
                    color: reviewHardMode ? "#fca5a5" : "#38bdf8",
                    border: reviewHardMode
                      ? "1px solid rgba(239, 68, 68, 0.4)"
                      : "1px solid rgba(255,255,255,0.2)",
                    fontSize: "16px",
                    fontWeight: "bold",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  {reviewHardMode
                    ? hardSentencesInCurrentLesson.map((idx) => (
                        <option key={idx} value={idx} style={{ color: "#000" }}>
                          {idx + 1} (Khó)
                        </option>
                      ))
                    : activeLesson.data.map((_, idx) => (
                        <option key={idx} value={idx} style={{ color: "#000" }}>
                          {idx + 1}
                        </option>
                      ))}
                </select>
                <span style={{ fontSize: "15px", color: "#64748b" }}>
                  / {activeLesson.data.length}
                </span>

                {/* TÍNH NĂNG LƯU SHEET */}
                <button
                  onClick={handleSaveToSheet}
                  disabled={isSavingSheet}
                  title="Lưu câu này lên Google Sheets"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: isSavingSheet ? "wait" : "pointer",
                    fontSize: "22px",
                    padding: "0 5px",
                    transition: "transform 0.2s",
                    opacity: isSavingSheet ? 0.5 : 1,
                  }}
                >
                  {isSavingSheet ? "⏳" : "🚀"}
                </button>

                <button
                  onClick={toggleSaveSentence}
                  title="Lưu câu này"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "24px",
                    padding: "0 5px",
                    color: isCurrentSaved ? "#f59e0b" : "#64748b",
                    transition: "transform 0.2s",
                    transform: isCurrentSaved ? "scale(1.2)" : "scale(1)",
                  }}
                >
                  {isCurrentSaved ? "⭐" : "☆"}
                </button>
              </div>
            </div>

            {/* BẢNG ĐIỀU KHIỂN AUDIO VÀ NÚT LƯU GOOGLE SHEETS MỚI NHẤT */}
            <div
              className="glass-panel"
              style={{
                padding: "20px",
                borderRadius: "16px",
                border: reviewHardMode
                  ? "1px solid rgba(239, 68, 68, 0.3)"
                  : "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "15px",
                }}
              >
                <button
                  className="btn-hover"
                  onClick={playSegment}
                  style={{
                    padding: "12px 18px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #38bdf8, #0ea5e9)",
                    color: "#fff",
                    border: "none",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  ▶ Phát câu này
                </button>
                <button
                  className="btn-hover"
                  onClick={() =>
                    playRange(
                      Math.max(0, activeLesson.currentIdx - 1),
                      activeLesson.currentIdx
                    )
                  }
                  style={{
                    padding: "12px 18px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.2)",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  🔗 Nghe (n-1) & (n)
                </button>
                <button
                  className="btn-hover"
                  onClick={() => playRange(0, activeLesson.currentIdx)}
                  style={{
                    padding: "12px 18px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.2)",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  ⏮ Từ đầu đến (n)
                </button>
                <button
                  className="btn-hover"
                  onClick={rewindAudio}
                  style={{
                    padding: "12px 18px",
                    borderRadius: "10px",
                    background: "rgba(0,0,0,0.3)",
                    color: "#e2e8f0",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  ⏪ Lùi 2s
                </button>

                {/* NÚT LƯU SHEET TO ĐÙNG Ở ĐÂY */}
                <button
                  className="btn-hover"
                  onClick={handleSaveToSheet}
                  disabled={isSavingSheet}
                  style={{
                    padding: "12px 18px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "#fff",
                    border: "none",
                    fontWeight: "bold",
                    cursor: isSavingSheet ? "wait" : "pointer",
                    boxShadow: "0 4px 10px rgba(16, 185, 129, 0.3)",
                  }}
                >
                  {isSavingSheet ? "⏳ Đang lưu..." : "🚀 Lưu Google Sheet"}
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "12px",
                  paddingBottom: "15px",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  marginBottom: "15px",
                }}
              >
                <span
                  style={{
                    color: "#a78bfa",
                    fontSize: "15px",
                    fontWeight: "bold",
                  }}
                >
                  🔀 Tùy chọn đoạn:
                </span>
                <span style={{ color: "#cbd5e1", fontSize: "14px" }}>Từ</span>
                <select
                  className="btn-hover"
                  value={customStartIdx}
                  onChange={(e) =>
                    setCustomStartIdx(parseInt(e.target.value, 10))
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    background: "rgba(0,0,0,0.3)",
                    color: "#a855f7",
                    border: "1px solid rgba(168, 85, 247, 0.3)",
                    outline: "none",
                    fontWeight: "bold",
                  }}
                >
                  {activeLesson.data.map((_, idx) => (
                    <option key={idx} value={idx} style={{ color: "#000" }}>
                      Câu {idx + 1}
                    </option>
                  ))}
                </select>
                <span style={{ color: "#cbd5e1", fontSize: "14px" }}>đến</span>
                <select
                  className="btn-hover"
                  value={customEndIdx}
                  onChange={(e) =>
                    setCustomEndIdx(parseInt(e.target.value, 10))
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    background: "rgba(0,0,0,0.3)",
                    color: "#a855f7",
                    border: "1px solid rgba(168, 85, 247, 0.3)",
                    outline: "none",
                    fontWeight: "bold",
                  }}
                >
                  {activeLesson.data.map((_, idx) => (
                    <option key={idx} value={idx} style={{ color: "#000" }}>
                      Câu {idx + 1}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-hover"
                  onClick={() => playRange(customStartIdx, customEndIdx)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    background: "linear-gradient(135deg, #a855f7, #7e22ce)",
                    color: "#fff",
                    border: "none",
                    fontWeight: "bold",
                    cursor: "pointer",
                    boxShadow: "0 4px 10px rgba(126, 34, 206, 0.3)",
                  }}
                >
                  ▶ Phát đoạn
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "25px",
                  alignItems: "center",
                }}
              >
                {/* CÔNG TẮC ĐỆM 3 GIÂY */}
                <label
                  className="btn-hover"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "15px",
                    color: "#60a5fa",
                    fontWeight: "bold",
                    padding: "5px 10px",
                    background: "rgba(96, 165, 250, 0.1)",
                    borderRadius: "8px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={usePreRoll}
                    onChange={(e) => setUsePreRoll(e.target.checked)}
                    style={{ transform: "scale(1.2)" }}
                  />{" "}
                  ⏪ Đệm 3s (Chống cắt mất chữ)
                </label>

                <label
                  className="btn-hover"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "15px",
                    color: "#34d399",
                    fontWeight: "bold",
                    padding: "5px 10px",
                    background: "rgba(52, 211, 153, 0.1)",
                    borderRadius: "8px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isAutoLoop}
                    onChange={(e) => setIsAutoLoop(e.target.checked)}
                    style={{ transform: "scale(1.2)" }}
                  />{" "}
                  🔁 Tự động lặp
                </label>

                <label
                  className="btn-hover"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "15px",
                    color: "#fbbf24",
                    fontWeight: "bold",
                    padding: "5px 10px",
                    background: "rgba(251, 191, 36, 0.1)",
                    borderRadius: "8px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showFullScript}
                    onChange={(e) => setShowFullScript(e.target.checked)}
                    style={{ transform: "scale(1.2)" }}
                  />{" "}
                  📜 Karaoke Script
                </label>

                <label
                  className="btn-hover"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "15px",
                    color: reviewHardMode ? "#ef4444" : "#cbd5e1",
                    fontWeight: "bold",
                    padding: "5px 10px",
                    background: reviewHardMode
                      ? "rgba(239, 68, 68, 0.1)"
                      : "rgba(255,255,255,0.05)",
                    borderRadius: "8px",
                    border: reviewHardMode
                      ? "1px solid rgba(239,68,68,0.5)"
                      : "1px solid transparent",
                    transition: "all 0.3s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={reviewHardMode}
                    onChange={(e) => {
                      setReviewMode(e.target.checked);
                      if (
                        e.target.checked &&
                        hardSentencesInCurrentLesson.length > 0
                      )
                        jumpToSentence(hardSentencesInCurrentLesson[0]);
                      else if (e.target.checked) {
                        alert("Chưa có lỗi sai nào trong bài này!");
                        setReviewMode(false);
                      }
                    }}
                    style={{ transform: "scale(1.2)" }}
                  />
                  🔥 Chỉ ôn câu sai ({hardSentencesInCurrentLesson.length})
                </label>

                <div style={{ marginLeft: "auto" }}>
                  <select
                    className="btn-hover"
                    value={playbackRate}
                    onChange={(e) =>
                      setPlaybackRate(parseFloat(e.target.value))
                    }
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "rgba(0,0,0,0.3)",
                      color: "#38bdf8",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      outline: "none",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    <option value={0.75} style={{ color: "#000" }}>
                      🐢 0.75x
                    </option>
                    <option value={0.85} style={{ color: "#000" }}>
                      🚶 0.85x
                    </option>
                    <option value={1} style={{ color: "#000" }}>
                      🏃 1.0x
                    </option>
                    <option value={1.25} style={{ color: "#000" }}>
                      🚀 1.25x
                    </option>
                    <option value={1.5} style={{ color: "#000" }}>
                      🔥 1.5x
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* VÙNG LÀM VIỆC */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: showFullScript ? "1fr 1fr" : "1fr",
                gap: "25px",
                transition: "all 0.4s ease",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <textarea
                  className={isShaking ? "shake-anim" : ""}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      isSuccess ? nextSentence() : handleCheck();
                    }
                  }}
                  placeholder="Gõ đáp án vào đây..."
                  style={{
                    width: "100%",
                    height: "130px",
                    fontSize: "18px",
                    padding: "18px",
                    borderRadius: "16px",
                    border: isSuccess
                      ? "2px solid #22c55e"
                      : "2px solid rgba(255,255,255,0.1)",
                    background: "rgba(0,0,0,0.2)",
                    color: "#fff",
                    outline: "none",
                    resize: "vertical",
                    transition: "all 0.3s ease",
                    boxShadow: isSuccess
                      ? "0 0 25px rgba(34, 197, 94, 0.3)"
                      : "inset 0 2px 4px rgba(0,0,0,0.3)",
                  }}
                />

                <div
                  style={{ display: "flex", gap: "15px", marginTop: "20px" }}
                >
                  <button
                    className={`btn-hover ${isSuccess ? "pulse-btn" : ""}`}
                    onClick={isSuccess ? nextSentence : handleCheck}
                    style={{
                      flex: 2,
                      padding: "16px",
                      fontSize: "18px",
                      background: isSuccess
                        ? "linear-gradient(135deg, #3b82f6, #2563eb)"
                        : "linear-gradient(135deg, #22c55e, #16a34a)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                    }}
                  >
                    {isSuccess
                      ? "Câu Tiếp Theo ⮕ (Enter)"
                      : "Kiểm tra lỗi ✓ (Enter)"}
                  </button>
                  {!isSuccess && (
                    <button
                      className="btn-hover"
                      onClick={handleSurrenderWord}
                      style={{
                        flex: 1,
                        padding: "16px",
                        fontSize: "16px",
                        background: "rgba(239, 68, 68, 0.1)",
                        color: "#fca5a5",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: "12px",
                        cursor: "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      🏳️ Gợi ý 1 từ
                    </button>
                  )}
                </div>

                <div
                  ref={resultBoxRef}
                  className="glass-panel"
                  style={{
                    marginTop: "25px",
                    padding: "25px",
                    borderRadius: "16px",
                    minHeight: "130px",
                    maxHeight: showFullScript ? "300px" : "350px",
                    overflowY: "auto",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "10px",
                      fontSize: "22px",
                      lineHeight: "1.8",
                    }}
                  >
                    {!showFeedback && (
                      <span
                        style={{
                          color: "#64748b",
                          fontStyle: "italic",
                          fontSize: "18px",
                        }}
                      >
                        Bản dịch sẽ tự động hiển thị khi bạn hoàn thành...
                      </span>
                    )}
                    {showFeedback &&
                      currentSegment &&
                      currentSegment.transcript
                        .split(/\s+/)
                        .filter(Boolean)
                        .map((word, i) => {
                          const userWords = input
                            .trim()
                            .split(/\s+/)
                            .filter(Boolean);
                          const rawTranscriptWords = currentSegment.transcript
                            .split(/\s+/)
                            .filter(Boolean);
                          let currentErrorIdx = -1;
                          for (let k = 0; k < rawTranscriptWords.length; k++) {
                            if (
                              normalize(userWords[k]) !==
                              normalize(rawTranscriptWords[k])
                            ) {
                              currentErrorIdx = k;
                              break;
                            }
                          }
                          if (
                            currentErrorIdx === -1 &&
                            userWords.length < rawTranscriptWords.length
                          )
                            currentErrorIdx = userWords.length;
                          if (i < currentErrorIdx || currentErrorIdx === -1)
                            return (
                              <span
                                key={i}
                                style={{
                                  color: "#34d399",
                                  fontWeight: "bold",
                                  textShadow: "0 0 8px rgba(52, 211, 153, 0.4)",
                                }}
                              >
                                {word}
                              </span>
                            );

                          if (i === currentErrorIdx && !isSuccess) {
                            const attempts = attemptsPerWord[i] || 0;
                            const cleanWord = word.replace(
                              /[^a-zA-Z0-9'’]/g,
                              ""
                            );
                            const revealCount = Math.min(
                              attempts > 0 ? attempts - 1 : 0,
                              cleanWord.length
                            );
                            let hintStr = cleanWord.substring(0, revealCount);
                            for (let j = revealCount; j < cleanWord.length; j++)
                              hintStr += "_";
                            return (
                              <span
                                className="pop-in"
                                key={i}
                                style={{
                                  background: "rgba(220, 38, 38, 0.2)",
                                  border: "1px solid rgba(248, 113, 113, 0.5)",
                                  padding: "4px 12px",
                                  borderRadius: "8px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "10px",
                                }}
                              >
                                {userWords[i] && (
                                  <span
                                    style={{
                                      color: "#f87171",
                                      textDecoration: "line-through",
                                      fontSize: "18px",
                                    }}
                                  >
                                    {userWords[i]}
                                  </span>
                                )}
                                <span
                                  style={{
                                    color: "#fbbf24",
                                    fontFamily: "monospace",
                                    fontWeight: "bold",
                                    letterSpacing: "3px",
                                  }}
                                >
                                  {hintStr}
                                </span>
                              </span>
                            );
                          }
                          return (
                            <span key={i} style={{ color: "#475569" }}>
                              ___
                            </span>
                          );
                        })}
                  </div>
                  {isSuccess && (
                    <div
                      className="pop-in"
                      style={{
                        marginTop: "25px",
                        borderTop: "1px solid rgba(255,255,255,0.1)",
                        paddingTop: "20px",
                      }}
                    >
                      <p
                        className="floating"
                        style={{
                          color: "#34d399",
                          fontWeight: "900",
                          fontSize: "22px",
                          margin: "0 0 15px 0",
                          display: "inline-block",
                        }}
                      >
                        <span style={{ fontSize: "26px", marginRight: "8px" }}>
                          🎉
                        </span>{" "}
                        Hoàn hảo! Xuất sắc!
                      </p>
                      <div
                        style={{
                          background: "rgba(139, 92, 246, 0.1)",
                          borderLeft: "4px solid #8b5cf6",
                          padding: "15px",
                          borderRadius: "0 8px 8px 0",
                        }}
                      >
                        <p
                          style={{
                            color: "#c4b5fd",
                            fontStyle: "italic",
                            margin: 0,
                            fontSize: "18px",
                            lineHeight: "1.6",
                          }}
                        >
                          🇻🇳 Dịch: {currentSegment?.translation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {showFullScript && (
                <div
                  className="fade-in glass-panel"
                  style={{
                    borderRadius: "16px",
                    padding: "20px",
                    maxHeight: "450px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      position: "sticky",
                      top: "-20px",
                      background: "rgba(15, 23, 42, 0.95)",
                      backdropFilter: "blur(10px)",
                      padding: "15px 0 10px 0",
                      marginBottom: "10px",
                      zIndex: 10,
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <h4
                      style={{
                        margin: 0,
                        color: "#fbbf24",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "18px",
                      }}
                    >
                      <span style={{ fontSize: "22px" }}>📜</span> Script
                      Tracker (Karaoke)
                    </h4>
                  </div>
                  {activeLesson.data.map((seg, idx) => {
                    const isPlaying = idx === currentPlayingIdx;
                    return (
                      <p
                        key={idx}
                        id={`script-line-${idx}`}
                        className="btn-hover"
                        style={{
                          margin: 0,
                          padding: "12px 15px",
                          borderRadius: "10px",
                          fontSize: "18px",
                          lineHeight: "1.6",
                          color: isPlaying ? "#0f172a" : "#cbd5e1",
                          background: isPlaying
                            ? "linear-gradient(90deg, #fbbf24, #f59e0b)"
                            : "rgba(255,255,255,0.03)",
                          fontWeight: isPlaying ? "bold" : "normal",
                          transform: isPlaying ? "scale(1.02)" : "scale(1)",
                          cursor: "pointer",
                        }}
                        onClick={() => playRange(idx, idx)}
                      >
                        <span
                          style={{
                            fontSize: "12px",
                            marginRight: "10px",
                            opacity: isPlaying ? 0.8 : 0.4,
                            background: isPlaying
                              ? "rgba(0,0,0,0.2)"
                              : "rgba(255,255,255,0.1)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          {idx + 1}
                        </span>
                        {seg.transcript}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: THỐNG KÊ LỖI SAI ================= */}
        {activeTab === "STATS" && (
          <div
            className="fade-in glass-panel"
            style={{ padding: "30px", borderRadius: "16px" }}
          >
            <h3
              style={{
                color: "#ef4444",
                marginTop: 0,
                fontSize: "24px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>📊</span> Bảng Phân Tích Lỗi Sai
            </h3>
            {errorLog.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "50px",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "12px",
                }}
              >
                <span style={{ fontSize: "40px" }}>🏆</span>
                <p
                  style={{
                    color: "#34d399",
                    fontSize: "18px",
                    fontWeight: "bold",
                  }}
                >
                  Tuyệt vời! Bạn chưa có lỗi sai nào được ghi nhận.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="error-table">
                  <thead>
                    <tr>
                      <th>Bài học</th>
                      <th>Câu</th>
                      <th>Từ Gốc (Đúng)</th>
                      <th>Bạn gõ nhầm thành</th>
                      <th>Phân loại</th>
                      <th>Số lần sai</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...errorLog]
                      .sort((a, b) => b.count - a.count)
                      .map((err) => (
                        <tr key={err.id}>
                          <td style={{ color: "#cbd5e1" }}>{err.lessonName}</td>
                          <td>
                            <span
                              style={{
                                background: "rgba(255,255,255,0.1)",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                color: "#38bdf8",
                              }}
                            >
                              Câu {err.sentenceIdx + 1}
                            </span>
                          </td>
                          <td style={{ color: "#34d399", fontWeight: "bold" }}>
                            {err.targetWord}
                          </td>
                          <td
                            style={{
                              color: "#f87171",
                              textDecoration: "line-through",
                            }}
                          >
                            {err.lastUserWord}
                          </td>
                          <td>
                            <span
                              style={{
                                background:
                                  err.type === "Thiếu từ"
                                    ? "rgba(245, 158, 11, 0.2)"
                                    : err.type === "Sai chính tả"
                                    ? "rgba(56, 189, 248, 0.2)"
                                    : "rgba(239, 68, 68, 0.2)",
                                color:
                                  err.type === "Thiếu từ"
                                    ? "#fbbf24"
                                    : err.type === "Sai chính tả"
                                    ? "#7dd3fc"
                                    : "#fca5a5",
                                padding: "4px 8px",
                                borderRadius: "4px",
                                fontSize: "12px",
                                fontWeight: "bold",
                              }}
                            >
                              {err.type}
                            </span>
                          </td>
                          <td>
                            <strong style={{ color: "#fff", fontSize: "16px" }}>
                              {err.count}
                            </strong>{" "}
                            lần
                          </td>
                          <td>
                            <button
                              className="btn-hover"
                              onClick={() =>
                                reviewErrorSentence(
                                  err.lessonId,
                                  err.sentenceIdx
                                )
                              }
                              style={{
                                background:
                                  "linear-gradient(135deg, #ef4444, #b91c1c)",
                                color: "#fff",
                                border: "none",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontWeight: "bold",
                                fontSize: "12px",
                              }}
                            >
                              🎯 Ôn lại
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            {errorLog.length > 0 && (
              <div style={{ marginTop: "20px", textAlign: "right" }}>
                <button
                  className="btn-hover"
                  onClick={() => {
                    if (window.confirm("Xóa lịch sử lỗi?")) setErrorLog([]);
                  }}
                  style={{
                    background: "transparent",
                    color: "#64748b",
                    border: "1px solid #64748b",
                    padding: "8px 15px",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  Xóa toàn bộ
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: CÂU ĐÃ LƯU (SAVED) ================= */}
        {activeTab === "SAVED" && (
          <div
            className="fade-in glass-panel"
            style={{ padding: "30px", borderRadius: "16px" }}
          >
            <h3
              style={{
                color: "#f59e0b",
                marginTop: 0,
                fontSize: "24px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>⭐</span> Danh Sách Ôn Tập ({savedSentences.length} câu)
            </h3>
            {savedSentences.length === 0 ? (
              <p
                style={{
                  color: "#64748b",
                  fontStyle: "italic",
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                Bấm biểu tượng ⭐ khi luyện nghe để lưu câu khó vào đây.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "15px",
                }}
              >
                {savedSentences.map((item) => (
                  <div
                    key={item.id}
                    className="btn-hover"
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      padding: "20px",
                      borderRadius: "12px",
                      borderLeft: "4px solid #f59e0b",
                      position: "relative",
                    }}
                  >
                    <button
                      onClick={() =>
                        setSavedSentences((prev) =>
                          prev.filter((s) => s.id !== item.id)
                        )
                      }
                      style={{
                        position: "absolute",
                        top: "15px",
                        right: "15px",
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "none",
                        color: "#ef4444",
                        width: "30px",
                        height: "30px",
                        borderRadius: "50%",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ✖
                    </button>
                    <div style={{ marginBottom: "10px" }}>
                      <span
                        style={{
                          background: "rgba(245, 158, 11, 0.2)",
                          color: "#fcd34d",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                      >
                        {item.lessonName}
                      </span>
                      <span
                        style={{
                          color: "#94a3b8",
                          fontSize: "13px",
                          marginLeft: "10px",
                        }}
                      >
                        Câu {item.sentenceIdx + 1}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: "0 0 8px 0",
                        fontSize: "18px",
                        color: "#e2e8f0",
                        paddingRight: "30px",
                        lineHeight: "1.5",
                      }}
                    >
                      {item.transcript}
                    </p>
                    <p
                      style={{
                        margin: "0 0 15px 0",
                        color: "#94a3b8",
                        fontStyle: "italic",
                        fontSize: "14px",
                      }}
                    >
                      🇻🇳 {item.translation}
                    </p>
                    <button
                      onClick={() =>
                        playSavedSentence(item.lessonId, item.sentenceIdx)
                      }
                      style={{
                        padding: "8px 16px",
                        background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      🎧 Nghe lại câu này
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 5: SỔ TỪ VỰNG ================= */}
        {activeTab === "VOCAB" && (
          <div
            className="fade-in glass-panel"
            style={{ padding: "30px", borderRadius: "16px" }}
          >
            <h3
              style={{
                color: "#a855f7",
                marginTop: 0,
                fontSize: "22px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>➕</span> Thêm từ mới
            </h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "15px",
                marginBottom: "40px",
                background: "rgba(0,0,0,0.2)",
                padding: "20px",
                borderRadius: "12px",
              }}
            >
              <input
                value={newVocab.word}
                onChange={(e) =>
                  setNewVocab({ ...newVocab, word: e.target.value })
                }
                placeholder="Từ vựng (VD: Circadian rhythm)"
                style={{
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.3)",
                  color: "#fff",
                  fontSize: "16px",
                  outline: "none",
                }}
              />
              <input
                value={newVocab.meaning}
                onChange={(e) =>
                  setNewVocab({ ...newVocab, meaning: e.target.value })
                }
                placeholder="Định nghĩa (VD: Nhịp sinh học)"
                style={{
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.3)",
                  color: "#fff",
                  fontSize: "16px",
                  outline: "none",
                }}
              />
              <textarea
                value={newVocab.example}
                onChange={(e) =>
                  setNewVocab({ ...newVocab, example: e.target.value })
                }
                placeholder="Câu ví dụ (VD: Sunlight affects our circadian rhythm.)"
                style={{
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.3)",
                  color: "#fff",
                  fontSize: "16px",
                  height: "90px",
                  resize: "vertical",
                  outline: "none",
                }}
              />
              <button
                className="btn-hover"
                onClick={saveVocab}
                style={{
                  padding: "14px",
                  background: "linear-gradient(135deg, #a855f7, #7e22ce)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: "bold",
                  fontSize: "18px",
                  cursor: "pointer",
                  marginTop: "5px",
                }}
              >
                💾 Lưu Vào Sổ Tay
              </button>
            </div>
            <h3
              style={{
                color: "#38bdf8",
                fontSize: "22px",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                paddingBottom: "10px",
              }}
            >
              📚 Sổ từ vựng ({vocabList.length} từ)
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "20px",
                marginTop: "20px",
              }}
            >
              {vocabList.map((v) => (
                <div
                  className="btn-hover"
                  key={v.id}
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    padding: "20px",
                    borderRadius: "12px",
                    borderTop: "4px solid #a855f7",
                    position: "relative",
                  }}
                >
                  <button
                    onClick={() => deleteVocab(v.id)}
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "none",
                      color: "#ef4444",
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      fontSize: "14px",
                      cursor: "pointer",
                    }}
                  >
                    ✖
                  </button>
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "20px",
                      fontWeight: "bold",
                      color: "#f8fafc",
                      paddingRight: "20px",
                    }}
                  >
                    {v.word}
                  </p>
                  <p
                    style={{
                      margin: "0 0 12px 0",
                      color: "#38bdf8",
                      fontSize: "16px",
                      background: "rgba(56, 189, 248, 0.1)",
                      display: "inline-block",
                      padding: "4px 10px",
                      borderRadius: "6px",
                    }}
                  >
                    {v.meaning}
                  </p>
                  {v.example && (
                    <div
                      style={{
                        borderLeft: "2px solid #64748b",
                        paddingLeft: "10px",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontStyle: "italic",
                          color: "#cbd5e1",
                          fontSize: "14px",
                        }}
                      >
                        "{v.example}"
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
