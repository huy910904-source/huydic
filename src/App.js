import React, { useState, useRef, useCallback, useEffect } from "react";

// --- BỘ LỌC TỪ VIẾT TẮT ---
const expandContractions = (str) => {
  let s = str?.toLowerCase() || "";
  const map = {
    "i'm": "i am", "can't": "cannot", "won't": "will not", "don't": "do not", "doesn't": "does not",
    "didn't": "did not", "isn't": "is not", "aren't": "are not", "haven't": "have not", "hasn't": "has not",
    "it's": "it is", "that's": "that is", "there's": "there is", "what's": "what is", "he's": "he is",
    "she's": "she is", "you're": "you are", "we're": "we are", "they're": "they are", "i've": "i have",
    "you've": "you have", "we've": "we have", "they've": "they have", "i'll": "i will", "you'll": "you will",
    "we'll": "we will", "they'll": "they will", "i'd": "i would", "you'd": "you would",
  };
  for (const [key, val] of Object.entries(map)) {
    s = s.replace(new RegExp(`\\b${key}\\b`, "g"), val);
  }
  return s.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
};

const normalize = (str) => expandContractions(str);

// ==========================================
// KÉT SẮT BÍ MẬT: LƯU TRỮ FILE AUDIO VĨNH VIỄN
// ==========================================
const audioDB = {
  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("DictationAudioDB", 1);
      request.onupgradeneeded = (e) => e.target.result.createObjectStore("audios");
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
  }
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

  // --- STATE HIỆU ỨNG (ANIMATIONS) ---
  const [isShaking, setIsShaking] = useState(false);
  const [keyForAnimation, setKeyForAnimation] = useState(0); // Để kích hoạt lại fade-in khi qua câu

  // --- STATE TÙY CHỈNH ĐOẠN & FULL SCRIPT ---
  const [customStartIdx, setCustomStartIdx] = useState(0);
  const [customEndIdx, setCustomEndIdx] = useState(0);
  const [showFullScript, setShowFullScript] = useState(false);
  const [currentPlayingIdx, setCurrentPlayingIdx] = useState(-1);

  // --- AUDIO CONTROLS & REFS ---
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isAutoLoop, setIsAutoLoop] = useState(false);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const resultBoxRef = useRef(null);
  const isTransitioning = useRef(false);
  const autoPlayRef = useRef(false);

  // --- SỔ TỪ VỰNG ---
  const [vocabList, setVocabList] = useState([]);
  const [newVocab, setNewVocab] = useState({ word: "", meaning: "", example: "" });

  // 1. TẢI DỮ LIỆU TỪ TRÌNH DUYỆT (KÈM AUDIO TỪ DATABASE)
  useEffect(() => {
    const loadSavedData = async () => {
      const savedVocab = localStorage.getItem("my_vocab_book");
      if (savedVocab) setVocabList(JSON.parse(savedVocab));
      
      const savedLibrary = localStorage.getItem("my_dictation_library");
      if (savedLibrary) {
        const parsedLib = JSON.parse(savedLibrary);
        setLibrary(parsedLib);
        const loadedUrls = {};
        for (const lesson of parsedLib) {
          try {
            const audioBlob = await audioDB.get(lesson.id);
            if (audioBlob) loadedUrls[lesson.id] = URL.createObjectURL(audioBlob);
          } catch (err) { console.log("Không tìm thấy audio cho bài:", lesson.id); }
        }
        setSessionAudioUrls(loadedUrls);
      }
      setIsDBLoading(false);
    };
    loadSavedData();
  }, []);

  useEffect(() => localStorage.setItem("my_vocab_book", JSON.stringify(vocabList)), [vocabList]);
  useEffect(() => localStorage.setItem("my_dictation_library", JSON.stringify(library)), [library]);

  useEffect(() => {
    if (showFeedback && resultBoxRef.current) {
      resultBoxRef.current.scrollTop = resultBoxRef.current.scrollHeight;
    }
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
  const currentSegment = activeLesson ? activeLesson.data[activeLesson.currentIdx] : null;
  const currentAudioUrl = sessionAudioUrls[activeLessonId];

  useEffect(() => {
    if (activeLesson) {
      setCustomStartIdx(0);
      setCustomEndIdx(activeLesson.currentIdx);
    }
  }, [activeLessonId, activeLesson?.currentIdx]);

  // HÀM KÍCH HOẠT HIỆU ỨNG RUNG
  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);
  };

  // AUTO-CHECK THỜI GIAN THỰC
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
  // PHÁT AUDIO NGỮ CẢNH
  // ==========================================
  const playRange = useCallback((startIdx, endIdx) => {
      if (!audioRef.current || !activeLesson) return;
      const safeStartIdx = Math.min(startIdx, endIdx);
      const safeEndIdx = Math.max(startIdx, endIdx);

      const startSegment = activeLesson.data[safeStartIdx];
      const endSegment = activeLesson.data[safeEndIdx];
      if (!startSegment || !endSegment) return;

      clearInterval(timerRef.current);
      audioRef.current.currentTime = startSegment.start_time;
      audioRef.current.play().catch((e) => console.log("Lỗi:", e));
      setCurrentPlayingIdx(safeStartIdx);

      timerRef.current = setInterval(() => {
        if (!audioRef.current || !activeLesson) return;
        const currentTime = audioRef.current.currentTime;

        const activeIdx = activeLesson.data.findIndex(s => currentTime >= s.start_time && currentTime <= s.end_time);
        if (activeIdx !== -1) setCurrentPlayingIdx(activeIdx);

        if (currentTime >= endSegment.end_time) {
          if (isAutoLoop && !isSuccess) {
            audioRef.current.currentTime = startSegment.start_time;
            audioRef.current.play();
          } else {
            audioRef.current.pause();
            clearInterval(timerRef.current);
            setCurrentPlayingIdx(-1);
          }
        }
      }, 100);
    },
    [activeLesson, isAutoLoop, isSuccess]
  );

  const playSegment = useCallback(() => {
    if (activeLesson) playRange(activeLesson.currentIdx, activeLesson.currentIdx);
  }, [activeLesson, playRange]);

  const rewindAudio = () => {
    if (audioRef.current && currentSegment) {
      let newTime = audioRef.current.currentTime - 2;
      if (newTime < currentSegment.start_time) newTime = currentSegment.start_time;
      audioRef.current.currentTime = newTime;
    }
  };

  // ==========================================
  // QUA CÂU (RENDER LẠI HIỆU ỨNG MỜ DẦN)
  // ==========================================
  const resetDictationState = () => {
    setInput(""); setAttemptsPerWord({}); setShowFeedback(false); setIsSuccess(false);
  };

  const jumpToSentence = (newIdx) => {
    if (!activeLesson) return;
    setLibrary((prev) => prev.map((lesson) => lesson.id === activeLesson.id ? { ...lesson, currentIdx: newIdx } : lesson));
    resetDictationState();
    setKeyForAnimation(prev => prev + 1); // Trigger Fade-in
    autoPlayRef.current = true;
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
    if (activeLesson && activeLesson.currentIdx < activeLesson.data.length - 1) {
      isTransitioning.current = true;
      jumpToSentence(activeLesson.currentIdx + 1);
      setTimeout(() => { isTransitioning.current = false; }, 500);
    } else {
      alert("🎉 Bạn đã hoàn thành toàn bộ bài nghe này!");
    }
  };

  // ==========================================
  // XỬ LÝ UPLOAD VÀ TẠO BÀI MỚI
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
        try { setNewJsonData(JSON.parse(event.target.result)); } catch (error) { alert("Lỗi JSON!"); }
      };
      reader.readAsText(file);
    }
  };

  const createNewLesson = async () => {
    if (!newJsonData || !newAudioFile) return;
    const newId = Date.now().toString();
    const newLesson = { id: newId, name: newFileName || "Bài học mới", data: newJsonData, currentIdx: 0 };
    try { await audioDB.save(newId, newAudioFile); } catch (err) { alert("Lỗi khi lưu Audio!"); }
    setLibrary((prev) => [newLesson, ...prev]);
    setSessionAudioUrls((prev) => ({ ...prev, [newId]: URL.createObjectURL(newAudioFile) }));
    setNewJsonData(null); setNewAudioFile(null); setNewFileName("");
    setActiveLessonId(newId); setActiveTab("DICTATION"); resetDictationState();
    setKeyForAnimation(prev => prev + 1);
  };

  const deleteLesson = async (id) => {
    if (window.confirm("Bạn có chắc muốn xóa vĩnh viễn bài này?")) {
      await audioDB.delete(id); 
      setLibrary((prev) => prev.filter((l) => l.id !== id));
      if (activeLessonId === id) { setActiveLessonId(null); setActiveTab("LIBRARY"); }
    }
  };

  // ==========================================
  // KIỂM TRA ĐÁP ÁN & HIỆU ỨNG KHI SAI
  // ==========================================
  const handleCheck = () => {
    if (!input.trim() || !currentSegment) return;
    const transcriptStr = normalize(currentSegment.transcript);
    const userStr = normalize(input);
    if (transcriptStr === userStr) {
      setIsSuccess(true); setShowFeedback(true);
      if (audioRef.current) audioRef.current.pause(); return;
    }
    const transcriptWords = transcriptStr.split(/\s+/).filter(Boolean);
    const userWords = userStr.split(/\s+/).filter(Boolean);
    let errorIdx = -1;
    for (let i = 0; i < transcriptWords.length; i++) {
      if (userWords[i] !== transcriptWords[i]) { errorIdx = i; break; }
    }
    if (errorIdx === -1 && userWords.length < transcriptWords.length) errorIdx = userWords.length;
    setAttemptsPerWord((prev) => ({ ...prev, [errorIdx]: (prev[errorIdx] || 0) + 1 }));
    setIsSuccess(false); setShowFeedback(true);
    triggerShake(); // Kích hoạt rung màn hình khi sai
  };

  const handleSurrenderWord = () => {
    const rawTranscriptWords = currentSegment.transcript.split(/\s+/).filter(Boolean);
    const userWords = input.trim().split(/\s+/).filter(Boolean);
    let errorIdx = -1;
    for (let i = 0; i < rawTranscriptWords.length; i++) {
      if (normalize(userWords[i]) !== normalize(rawTranscriptWords[i])) { errorIdx = i; break; }
    }
    if (errorIdx === -1 && userWords.length < rawTranscriptWords.length) errorIdx = userWords.length;
    if (errorIdx !== -1) {
      const correctWord = rawTranscriptWords[errorIdx].replace(/[^a-zA-Z0-9'’]/g, "");
      const newInputArray = userWords.slice(0, errorIdx);
      newInputArray.push(correctWord);
      setInput(newInputArray.join(" ") + " ");
      triggerShake(); // Rung nhẹ để báo hiệu có thay đổi
      setTimeout(() => handleCheck(), 100);
    }
  };

  const saveVocab = () => {
    if (!newVocab.word) return;
    setVocabList([{ ...newVocab, id: Date.now() }, ...vocabList]);
    setNewVocab({ word: "", meaning: "", example: "" });
  };
  const deleteVocab = (id) => setVocabList(vocabList.filter((v) => v.id !== id));

  if (isDBLoading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Đang tải dữ liệu từ máy...</div>;

  // ==========================================
  // RENDER GIAO DIỆN CHÍNH
  // ==========================================
  return (
    <div style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto", fontFamily: "sans-serif", backgroundColor: "#0f172a", color: "#e2e8f0", minHeight: "100vh" }}>
      
      {/* BỘ STYLE CHỨA CÁC KEYFRAMES ANIMATION */}
      <style>{`
        .fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .pop-in { animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .shake-anim { animation: shake 0.4s ease-in-out; }
        .pulse-btn { animation: pulseGlow 1.5s infinite; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); }
          70% { box-shadow: 0 0 0 12px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
      `}</style>

      {/* HEADER TABS */}
      <div style={{ display: "flex", gap: "10px", borderBottom: "2px solid #334155", paddingBottom: "10px", marginBottom: "20px" }}>
        <button onClick={() => setActiveTab("LIBRARY")} style={{ flex: 1, padding: "12px", fontSize: "16px", fontWeight: "bold", background: activeTab === "LIBRARY" ? "#10b981" : "transparent", color: activeTab === "LIBRARY" ? "#0f172a" : "#94a3b8", border: "none", borderRadius: "8px", cursor: "pointer", transition: "all 0.3s" }}>
          📚 Thư Viện ({library.length})
        </button>
        <button onClick={() => { if (activeLessonId) { setActiveTab("DICTATION"); setKeyForAnimation(prev=>prev+1); } else alert("Chọn bài học trước!"); }} style={{ flex: 1, padding: "12px", fontSize: "16px", fontWeight: "bold", background: activeTab === "DICTATION" ? "#38bdf8" : "transparent", color: activeTab === "DICTATION" ? "#0f172a" : "#94a3b8", border: "none", borderRadius: "8px", cursor: "pointer", transition: "all 0.3s", opacity: activeLessonId ? 1 : 0.5 }}>
          🎧 Luyện Nghe
        </button>
        <button onClick={() => setActiveTab("VOCAB")} style={{ flex: 1, padding: "12px", fontSize: "16px", fontWeight: "bold", background: activeTab === "VOCAB" ? "#a855f7" : "transparent", color: activeTab === "VOCAB" ? "#fff" : "#94a3b8", border: "none", borderRadius: "8px", cursor: "pointer", transition: "all 0.3s" }}>
          📖 Sổ Từ ({vocabList.length})
        </button>
      </div>

      {/* ================= TAB 1: THƯ VIỆN ================= */}
      {activeTab === "LIBRARY" && (
        <div className="fade-in">
          <div style={{ background: "#1e293b", padding: "20px", borderRadius: "12px", marginBottom: "30px", border: "2px dashed #334155" }}>
            <h3 style={{ color: "#38bdf8", marginTop: 0 }}>➕ Thêm Bài Học Mới</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "15px" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <p style={{ margin: "0 0 5px 0", fontSize: "14px", color: "#94a3b8" }}>1. Tải lên Audio (.mp3)</p>
                <input type="file" accept=".mp3, .wav, audio/mp3, audio/wav, audio/*" onChange={handleNewAudioUpload} style={{ color: "#fff" }} />
              </div>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <p style={{ margin: "0 0 5px 0", fontSize: "14px", color: "#94a3b8" }}>2. Tải lên Script (.json)</p>
                <input type="file" accept=".json" onChange={handleNewJsonUpload} style={{ color: "#fff" }} />
              </div>
            </div>
            <button onClick={createNewLesson} disabled={!newJsonData || !newAudioFile} style={{ marginTop: "15px", padding: "12px 20px", background: !newJsonData || !newAudioFile ? "#334155" : "#10b981", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: !newJsonData || !newAudioFile ? "not-allowed" : "pointer" }}>
              Tạo và Học Ngay 🚀
            </button>
          </div>

          <h3 style={{ color: "#e2e8f0" }}>📂 Các bài học đang theo dõi</h3>
          {library.length === 0 ? (
            <p style={{ color: "#64748b", fontStyle: "italic" }}>Thư viện của bạn đang trống.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {library.map((lesson) => (
                <div key={lesson.id} style={{ background: "#1e293b", padding: "20px", borderRadius: "12px", borderLeft: "4px solid #38bdf8", position: "relative" }}>
                  <button onClick={() => deleteLesson(lesson.id)} style={{ position: "absolute", top: "15px", right: "15px", background: "transparent", border: "none", color: "#ef4444", fontSize: "16px", cursor: "pointer" }}>🗑 Xóa</button>
                  <h3 style={{ margin: "0 0 10px 0", color: "#fff" }}>{lesson.name}</h3>
                  <div style={{ background: "#0f172a", borderRadius: "8px", height: "8px", overflow: "hidden", marginBottom: "10px" }}>
                    <div style={{ width: `${(lesson.currentIdx / lesson.data.length) * 100}%`, height: "100%", background: "#10b981", transition: "width 0.4s ease-out" }}></div>
                  </div>
                  <p style={{ margin: "0 0 15px 0", fontSize: "14px", color: "#94a3b8" }}>Tiến độ: Câu {lesson.currentIdx + 1} / {lesson.data.length}</p>
                  
                  {sessionAudioUrls[lesson.id] ? (
                    <button onClick={() => { setActiveLessonId(lesson.id); setActiveTab("DICTATION"); resetDictationState(); setKeyForAnimation(prev=>prev+1); }} style={{ padding: "10px 20px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
                      ▶ Học tiếp
                    </button>
                  ) : (
                    <div style={{ background: "#334155", padding: "10px", borderRadius: "8px" }}>
                      <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#fca5a5" }}>⚠ Bộ nhớ bị xóa, cần nối lại MP3:</p>
                      <input type="file" accept=".mp3, .wav, audio/mp3, audio/wav, audio/*" onChange={async (e) => { 
                        if (e.target.files[0]) { 
                          await audioDB.save(lesson.id, e.target.files[0]);
                          setSessionAudioUrls((prev) => ({ ...prev, [lesson.id]: URL.createObjectURL(e.target.files[0]) })); 
                        } 
                      }} style={{ color: "#fff", fontSize: "13px" }} />
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
        <div key={keyForAnimation} className="fade-in" style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>
          <audio ref={audioRef} src={currentAudioUrl} />

          {/* HÀNG HEADER */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
            <span style={{ fontSize: "18px", color: "#94a3b8", fontWeight: "bold" }}>{activeLesson.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px", color: "#e2e8f0", fontWeight: "bold" }}>Đang làm câu</span>
              <select
                value={activeLesson.currentIdx}
                onChange={(e) => jumpToSentence(parseInt(e.target.value, 10))}
                style={{ padding: "6px 12px", borderRadius: "8px", background: "#1e293b", color: "#38bdf8", border: "1px solid #334155", fontSize: "16px", fontWeight: "bold", outline: "none", cursor: "pointer" }}
              >
                {activeLesson.data.map((_, idx) => ( <option key={idx} value={idx}>{idx + 1}</option> ))}
              </select>
              <span style={{ fontSize: "16px", color: "#94a3b8", fontWeight: "bold" }}>/ {activeLesson.data.length}</span>
            </div>
          </div>

          {/* BẢNG ĐIỀU KHIỂN AUDIO */}
          <div style={{ background: "#1e293b", padding: "15px", borderRadius: "12px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "15px" }}>
              <button onClick={playSegment} style={{ padding: "10px 15px", borderRadius: "8px", background: "#38bdf8", color: "#0f172a", border: "none", fontWeight: "bold", cursor: "pointer", display: 'flex', alignItems: 'center', gap: '5px' }}>
                ▶ Phát câu này
              </button>
              <button onClick={() => playRange(Math.max(0, activeLesson.currentIdx - 1), activeLesson.currentIdx)} style={{ padding: "10px 15px", borderRadius: "8px", background: "#475569", color: "#fff", border: "1px solid #64748b", fontWeight: "bold", cursor: "pointer" }}>
                🔗 Nghe (n-1) & (n)
              </button>
              <button onClick={() => playRange(0, activeLesson.currentIdx)} style={{ padding: "10px 15px", borderRadius: "8px", background: "#475569", color: "#fff", border: "1px solid #64748b", fontWeight: "bold", cursor: "pointer" }}>
                ⏮ Nghe từ Câu 1 đến (n)
              </button>
              <button onClick={rewindAudio} style={{ padding: "10px 15px", borderRadius: "8px", background: "#334155", color: "#e2e8f0", border: "none", cursor: "pointer" }}>
                ⏪ Lùi 2s
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', paddingBottom: '15px', borderBottom: "1px solid #334155", marginBottom: '15px' }}>
              <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 'bold' }}>🔀 Tùy chọn đoạn:</span>
              <span style={{ color: '#e2e8f0', fontSize: '14px' }}>Từ</span>
              <select value={customStartIdx} onChange={(e) => setCustomStartIdx(parseInt(e.target.value, 10))} style={{ padding: "4px 8px", borderRadius: "6px", background: "#0f172a", color: "#a855f7", border: "1px solid #334155", outline: "none" }}>
                {activeLesson.data.map((_, idx) => ( <option key={idx} value={idx}>Câu {idx + 1}</option> ))}
              </select>
              <span style={{ color: '#e2e8f0', fontSize: '14px' }}>đến</span>
              <select value={customEndIdx} onChange={(e) => setCustomEndIdx(parseInt(e.target.value, 10))} style={{ padding: "4px 8px", borderRadius: "6px", background: "#0f172a", color: "#a855f7", border: "1px solid #334155", outline: "none" }}>
                {activeLesson.data.map((_, idx) => ( <option key={idx} value={idx}>Câu {idx + 1}</option> ))}
              </select>
              <button onClick={() => playRange(customStartIdx, customEndIdx)} style={{ padding: "6px 15px", borderRadius: "6px", background: "#a855f7", color: "#fff", border: "none", fontWeight: "bold", cursor: "pointer" }}>
                ▶ Phát đoạn
              </button>
            </div>
            
            <div style={{ display: "flex", flexWrap: 'wrap', gap: "20px", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "14px", color: "#10b981", fontWeight: 'bold' }}>
                <input type="checkbox" checked={isAutoLoop} onChange={(e) => setIsAutoLoop(e.target.checked)} />
                🔁 Tự động lặp
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "14px", color: "#fbbf24", fontWeight: 'bold' }}>
                <input type="checkbox" checked={showFullScript} onChange={(e) => setShowFullScript(e.target.checked)} />
                📜 Hiện Full Script
              </label>

              <div style={{marginLeft: 'auto'}}>
                <select value={playbackRate} onChange={(e) => setPlaybackRate(parseFloat(e.target.value))} style={{ padding: "6px", borderRadius: "6px", background: "#0f172a", color: "#38bdf8", border: "1px solid #334155", outline: "none" }}>
                  <option value={0.75}>🐢 0.75x</option>
                  <option value={0.85}>🚶 0.85x</option>
                  <option value={1}>🏃 1.0x</option>
                  <option value={1.25}>🚀 1.25x</option>
                  <option value={1.5}>🔥 1.5x</option>
                </select>
              </div>
            </div>
          </div>

          {/* VÙNG LÀM VIỆC */}
          <div style={{ display: 'grid', gridTemplateColumns: showFullScript ? '1fr 1fr' : '1fr', gap: '20px', transition: 'all 0.3s' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                placeholder="Gõ đáp án vào đây... (Hệ thống tự động chấm điểm)"
                style={{ width: "100%", height: "120px", fontSize: "18px", padding: "15px", borderRadius: "12px", border: isSuccess ? "2px solid #22c55e" : "2px solid #334155", background: "#1e293b", color: "#fff", outline: "none", resize: "vertical", transition: "border 0.3s, box-shadow 0.3s", boxShadow: isSuccess ? "0 0 15px rgba(34, 197, 94, 0.2)" : "none" }}
              />

              <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                <button 
                  className={isSuccess ? "pulse-btn" : ""}
                  onClick={isSuccess ? nextSentence : handleCheck} 
                  style={{ flex: 2, padding: "15px", fontSize: "18px", background: isSuccess ? "#3b82f6" : "#22c55e", color: "white", border: "none", borderRadius: "12px", cursor: "pointer", fontWeight: "bold", transition: "background 0.3s" }}
                >
                  {isSuccess ? "Tiếp tục ⮕ (Enter)" : "Kiểm tra lỗi ✓ (Enter)"}
                </button>
                {!isSuccess && (
                  <button onClick={handleSurrenderWord} style={{ flex: 1, padding: "15px", fontSize: "16px", background: "#334155", color: "#fca5a5", border: "none", borderRadius: "12px", cursor: "pointer", fontWeight: "bold" }}>
                    🏳️ Cho xin 1 từ
                  </button>
                )}
              </div>

              <div ref={resultBoxRef} style={{ marginTop: "20px", border: "2px solid #334155", padding: "20px", borderRadius: "12px", background: "#1e293b", minHeight: "120px", maxHeight: showFullScript ? "250px" : "300px", overflowY: "auto", position: 'relative' }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", fontSize: "20px", lineHeight: "1.8" }}>
                  {!showFeedback && <span style={{ color: "#64748b", fontStyle: "italic" }}>Bản dịch sẽ tự động hiện khi hoàn thành...</span>}
                  
                  {showFeedback && currentSegment && currentSegment.transcript.split(/\s+/).filter(Boolean).map((word, i) => {
                    const userWords = input.trim().split(/\s+/).filter(Boolean);
                    const rawTranscriptWords = currentSegment.transcript.split(/\s+/).filter(Boolean);
                    let currentErrorIdx = -1;
                    for (let k = 0; k < rawTranscriptWords.length; k++) {
                      if (normalize(userWords[k]) !== normalize(rawTranscriptWords[k])) { currentErrorIdx = k; break; }
                    }
                    if (currentErrorIdx === -1 && userWords.length < rawTranscriptWords.length) currentErrorIdx = userWords.length;

                    if (i < currentErrorIdx || currentErrorIdx === -1) return <span key={i} style={{ color: "#22c55e", fontWeight: "bold", transition: "color 0.3s" }}>{word}</span>;
                    
                    if (i === currentErrorIdx && !isSuccess) {
                      const attempts = attemptsPerWord[i] || 0;
                      const cleanWord = word.replace(/[^a-zA-Z0-9'’]/g, "");
                      const revealCount = Math.min(attempts > 0 ? attempts - 1 : 0, cleanWord.length);
                      let hintStr = cleanWord.substring(0, revealCount);
                      for (let j = revealCount; j < cleanWord.length; j++) hintStr += "_";
                      return (
                        <span key={i} style={{ background: "#450a0a", border: "1px solid #f87171", padding: "2px 10px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "8px", transition: "all 0.3s" }}>
                          {userWords[i] && <span style={{ color: "#ef4444", textDecoration: "line-through", fontSize: "16px" }}>{userWords[i]}</span>}
                          <span style={{ color: "#fbbf24", fontFamily: "monospace", fontWeight: "bold", letterSpacing: "2px" }}>{hintStr}</span>
                        </span>
                      );
                    }
                    return <span key={i} style={{ color: "#475569", transition: "color 0.3s" }}>___</span>;
                  })}
                </div>
                {isSuccess && (
                  <div className="pop-in" style={{ marginTop: "20px", borderTop: "2px dashed #475569", paddingTop: "15px" }}>
                    <p style={{ color: "#22c55e", fontWeight: "bold", fontSize: "18px" }}>🎉 Hoàn hảo!</p>
                    <p style={{ color: "#a78bfa", fontStyle: "italic", marginBottom: "10px" }}>🇻🇳 Dịch: {currentSegment?.translation}</p>
                  </div>
                )}
              </div>
            </div>

            {/* CỘT 2: FULL SCRIPT (KARAOKE) */}
            {showFullScript && (
              <div className="fade-in" style={{ background: "#1e293b", border: "2px solid #334155", borderRadius: "12px", padding: "20px", maxHeight: "400px", overflowY: "auto", display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#fbbf24', borderBottom: '1px solid #334155', paddingBottom: '10px', position: 'sticky', top: '-20px', background: '#1e293b', zIndex: 10 }}>📜 Full Script Tracker</h4>
                {activeLesson.data.map((seg, idx) => {
                  const isPlaying = idx === currentPlayingIdx;
                  return (
                    <p 
                      key={idx} 
                      id={`script-line-${idx}`}
                      style={{
                        margin: 0,
                        padding: '10px',
                        borderRadius: '8px',
                        fontSize: '18px',
                        lineHeight: '1.6',
                        color: isPlaying ? '#0f172a' : '#94a3b8',
                        background: isPlaying ? '#fbbf24' : 'transparent',
                        fontWeight: isPlaying ? 'bold' : 'normal',
                        transform: isPlaying ? 'scale(1.02)' : 'scale(1)',
                        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                        cursor: 'pointer'
                      }}
                      onClick={() => playRange(idx, idx)}
                    >
                      <span style={{ fontSize: '12px', marginRight: '8px', opacity: 0.7 }}>[{idx + 1}]</span>
                      {seg.transcript}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 3: SỔ TỪ VỰNG ================= */}
      {activeTab === "VOCAB" && (
        <div className="fade-in" style={{ background: "#1e293b", padding: "20px", borderRadius: "12px" }}>
          <h3 style={{ color: "#a855f7", marginTop: 0 }}>➕ Thêm từ mới</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "30px" }}>
            <input value={newVocab.word} onChange={(e) => setNewVocab({ ...newVocab, word: e.target.value })} placeholder="Từ vựng (VD: Melatonin)" style={{ padding: "12px", borderRadius: "8px", border: "1px solid #334155", background: "#0f172a", color: "#fff", fontSize: "16px" }} />
            <input value={newVocab.meaning} onChange={(e) => setNewVocab({ ...newVocab, meaning: e.target.value })} placeholder="Định nghĩa (VD: Hormone gây buồn ngủ)" style={{ padding: "12px", borderRadius: "8px", border: "1px solid #334155", background: "#0f172a", color: "#fff", fontSize: "16px" }} />
            <textarea value={newVocab.example} onChange={(e) => setNewVocab({ ...newVocab, example: e.target.value })} placeholder="Câu ví dụ (VD: Melatonin helps us sleep.)" style={{ padding: "12px", borderRadius: "8px", border: "1px solid #334155", background: "#0f172a", color: "#fff", fontSize: "16px", height: "80px", resize: "vertical" }} />
            <button onClick={saveVocab} style={{ padding: "12px", background: "#a855f7", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "16px", cursor: "pointer", transition: "transform 0.2s" }} onMouseDown={(e) => e.target.style.transform = "scale(0.95)"} onMouseUp={(e) => e.target.style.transform = "scale(1)"}>
              Lưu vào sổ 💾
            </button>
          </div>

          <h3 style={{ color: "#38bdf8" }}>📚 Danh sách từ vựng của bạn</h3>
          {vocabList.length === 0 ? (
            <p style={{ color: "#64748b", fontStyle: "italic" }}>Chưa có từ vựng nào được lưu.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {vocabList.map((v) => (
                <div key={v.id} style={{ background: "#0f172a", padding: "15px", borderRadius: "8px", borderLeft: "4px solid #a855f7", position: "relative" }}>
                  <button onClick={() => deleteVocab(v.id)} style={{ position: "absolute", top: "10px", right: "10px", background: "transparent", border: "none", color: "#ef4444", fontSize: "18px", cursor: "pointer", transition: "transform 0.2s" }} onMouseOver={(e) => e.target.style.transform = "scale(1.2)"} onMouseOut={(e) => e.target.style.transform = "scale(1)"}>✖</button>
                  <p style={{ margin: "0 0 5px 0", fontSize: "18px", fontWeight: "bold", color: "#e2e8f0" }}>{v.word}</p>
                  <p style={{ margin: "0 0 8px 0", color: "#38bdf8", fontSize: "15px" }}>{v.meaning}</p>
                  {v.example && <p style={{ margin: 0, fontStyle: "italic", color: "#94a3b8", fontSize: "14px" }}>Ví dụ: "{v.example}"</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}