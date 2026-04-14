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
  const [keyForAnimation, setKeyForAnimation] = useState(0);

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
          } catch (err) { console.log("Lỗi:", lesson.id); }
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

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);
  };

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

  const resetDictationState = () => {
    setInput(""); setAttemptsPerWord({}); setShowFeedback(false); setIsSuccess(false);
  };

  const jumpToSentence = (newIdx) => {
    if (!activeLesson) return;
    setLibrary((prev) => prev.map((lesson) => lesson.id === activeLesson.id ? { ...lesson, currentIdx: newIdx } : lesson));
    resetDictationState();
    setKeyForAnimation(prev => prev + 1);
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
    triggerShake(); 
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
      triggerShake(); 
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

  return (
    <div className="animated-bg" style={{ minHeight: "100vh", color: "#e2e8f0", fontFamily: "'Inter', sans-serif" }}>
      
      {/* ==========================================
          BỘ STYLE CHỨA CÁC ANIMATIONS TUYỆT ĐỈNH
      ========================================== */}
      <style>{`
        /* Nền chuyển động Dải Ngân Hà */
        .animated-bg {
          background: linear-gradient(-45deg, #0f172a, #1e293b, #111827, #1e1b4b);
          background-size: 400% 400%;
          animation: gradientMove 15s ease infinite;
        }

        /* Các lớp Hiệu ứng động */
        .fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .pop-in { animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .shake-anim { animation: shake 0.4s ease-in-out; }
        .pulse-btn { animation: pulseGlow 1.5s infinite; }
        .floating { animation: floatAnim 3s ease-in-out infinite; }
        
        /* Hiệu ứng Nút bấm (Tương tác vật lý) */
        .btn-hover {
          transition: all 0.2s ease;
        }
        .btn-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(0, 0, 0, 0.2);
          filter: brightness(1.1);
        }
        .btn-hover:active {
          transform: translateY(1px);
        }
        
        /* Định nghĩa Keyframes */
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
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
        @keyframes floatAnim {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); text-shadow: 0 10px 15px rgba(34, 197, 94, 0.3); }
          100% { transform: translateY(0px); }
        }
        
        /* Hiệu ứng kính mờ (Glassmorphism) cho các khối */
        .glass-panel {
          background: rgba(30, 41, 59, 0.85);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
      `}</style>

      <div style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>
        
        {/* HEADER TABS CÓ HOVER */}
        <div style={{ display: "flex", gap: "10px", borderBottom: "2px solid rgba(255,255,255,0.1)", paddingBottom: "15px", marginBottom: "25px" }}>
          <button className="btn-hover" onClick={() => setActiveTab("LIBRARY")} style={{ flex: 1, padding: "14px", fontSize: "16px", fontWeight: "bold", background: activeTab === "LIBRARY" ? "#10b981" : "rgba(255,255,255,0.05)", color: activeTab === "LIBRARY" ? "#0f172a" : "#94a3b8", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", cursor: "pointer" }}>
            📚 Thư Viện ({library.length})
          </button>
          <button className="btn-hover" onClick={() => { if (activeLessonId) { setActiveTab("DICTATION"); setKeyForAnimation(prev=>prev+1); } else alert("Chọn bài học trước!"); }} style={{ flex: 1, padding: "14px", fontSize: "16px", fontWeight: "bold", background: activeTab === "DICTATION" ? "#38bdf8" : "rgba(255,255,255,0.05)", color: activeTab === "DICTATION" ? "#0f172a" : "#94a3b8", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", cursor: "pointer", opacity: activeLessonId ? 1 : 0.5 }}>
            🎧 Luyện Nghe
          </button>
          <button className="btn-hover" onClick={() => setActiveTab("VOCAB")} style={{ flex: 1, padding: "14px", fontSize: "16px", fontWeight: "bold", background: activeTab === "VOCAB" ? "#a855f7" : "rgba(255,255,255,0.05)", color: activeTab === "VOCAB" ? "#fff" : "#94a3b8", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", cursor: "pointer" }}>
            📖 Sổ Từ ({vocabList.length})
          </button>
        </div>

        {/* ================= TAB 1: THƯ VIỆN ================= */}
        {activeTab === "LIBRARY" && (
          <div className="fade-in">
            <div className="glass-panel" style={{ padding: "25px", borderRadius: "16px", marginBottom: "30px", border: "2px dashed rgba(56, 189, 248, 0.4)" }}>
              <h3 style={{ color: "#38bdf8", marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '24px' }}>➕</span> Thêm Bài Học Mới
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#cbd5e1" }}>1. Tải lên Audio (.mp3)</p>
                  <input type="file" accept=".mp3, .wav, audio/*" onChange={handleNewAudioUpload} style={{ color: "#fff", width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }} />
                </div>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#cbd5e1" }}>2. Tải lên Script (.json)</p>
                  <input type="file" accept=".json" onChange={handleNewJsonUpload} style={{ color: "#fff", width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }} />
                </div>
              </div>
              <button className="btn-hover" onClick={createNewLesson} disabled={!newJsonData || !newAudioFile} style={{ marginTop: "20px", padding: "14px 24px", background: !newJsonData || !newAudioFile ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #10b981, #059669)", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "bold", fontSize: '16px', cursor: !newJsonData || !newAudioFile ? "not-allowed" : "pointer", width: '100%' }}>
                Tạo và Học Ngay 🚀
              </button>
            </div>

            <h3 style={{ color: "#f8fafc", marginBottom: '20px' }}>📂 Các bài học đang theo dõi</h3>
            {library.length === 0 ? (
              <p style={{ color: "#64748b", fontStyle: "italic", textAlign: 'center', padding: '40px' }}>Thư viện của bạn đang trống. Hãy thêm bài học ở trên nhé!</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                {library.map((lesson) => (
                  <div key={lesson.id} className="glass-panel" style={{ padding: "20px", borderRadius: "16px", borderLeft: "5px solid #38bdf8", position: "relative", transition: "transform 0.3s ease" }}>
                    <button className="btn-hover" onClick={() => deleteLesson(lesson.id)} style={{ position: "absolute", top: "20px", right: "20px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", borderRadius: '8px', padding: '6px 12px', fontSize: "14px", cursor: "pointer" }}>🗑 Xóa</button>
                    <h3 style={{ margin: "0 0 12px 0", color: "#f8fafc", fontSize: '20px', paddingRight: '60px' }}>{lesson.name}</h3>
                    <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "10px", height: "10px", overflow: "hidden", marginBottom: "12px", boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' }}>
                      <div style={{ width: `${(lesson.currentIdx / lesson.data.length) * 100}%`, height: "100%", background: "linear-gradient(90deg, #38bdf8, #818cf8)", transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)" }}></div>
                    </div>
                    <p style={{ margin: "0 0 15px 0", fontSize: "14px", color: "#94a3b8" }}>Tiến độ: <strong style={{color: '#fff'}}>Câu {lesson.currentIdx + 1}</strong> / {lesson.data.length}</p>
                    
                    {sessionAudioUrls[lesson.id] ? (
                      <button className="btn-hover" onClick={() => { setActiveLessonId(lesson.id); setActiveTab("DICTATION"); resetDictationState(); setKeyForAnimation(prev=>prev+1); }} style={{ padding: "10px 24px", background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
                        ▶ Tiếp tục học
                      </button>
                    ) : (
                      <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "12px", borderRadius: "10px" }}>
                        <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#fca5a5" }}>⚠ Bộ nhớ hệ thống đã dọn dẹp. Vui lòng chọn lại file MP3 để học tiếp:</p>
                        <input type="file" accept=".mp3, .wav, audio/*" onChange={async (e) => { 
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
              <span style={{ fontSize: "20px", color: "#f8fafc", fontWeight: "bold", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>{activeLesson.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", background: 'rgba(0,0,0,0.2)', padding: '5px 15px', borderRadius: '20px' }}>
                <span style={{ fontSize: "15px", color: "#cbd5e1" }}>Đang ở câu</span>
                <select className="btn-hover" value={activeLesson.currentIdx} onChange={(e) => jumpToSentence(parseInt(e.target.value, 10))} style={{ padding: "6px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.1)", color: "#38bdf8", border: "1px solid rgba(255,255,255,0.2)", fontSize: "16px", fontWeight: "bold", outline: "none", cursor: "pointer" }}>
                  {activeLesson.data.map((_, idx) => ( <option key={idx} value={idx} style={{color: '#000'}}>{idx + 1}</option> ))}
                </select>
                <span style={{ fontSize: "15px", color: "#64748b" }}>/ {activeLesson.data.length}</span>
              </div>
            </div>

            {/* BẢNG ĐIỀU KHIỂN AUDIO */}
            <div className="glass-panel" style={{ padding: "20px", borderRadius: "16px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "15px" }}>
                <button className="btn-hover" onClick={playSegment} style={{ padding: "12px 18px", borderRadius: "10px", background: "linear-gradient(135deg, #38bdf8, #0ea5e9)", color: "#fff", border: "none", fontWeight: "bold", cursor: "pointer", display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 10px rgba(14, 165, 233, 0.3)' }}>
                  ▶ Phát câu này
                </button>
                <button className="btn-hover" onClick={() => playRange(Math.max(0, activeLesson.currentIdx - 1), activeLesson.currentIdx)} style={{ padding: "12px 18px", borderRadius: "10px", background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", fontWeight: "bold", cursor: "pointer" }}>
                  🔗 Nghe (n-1) & (n)
                </button>
                <button className="btn-hover" onClick={() => playRange(0, activeLesson.currentIdx)} style={{ padding: "12px 18px", borderRadius: "10px", background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", fontWeight: "bold", cursor: "pointer" }}>
                  ⏮ Nghe từ đầu đến (n)
                </button>
                <button className="btn-hover" onClick={rewindAudio} style={{ padding: "12px 18px", borderRadius: "10px", background: "rgba(0,0,0,0.3)", color: "#e2e8f0", border: "none", cursor: "pointer" }}>
                  ⏪ Lùi 2s
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', paddingBottom: '15px', borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: '15px' }}>
                <span style={{ color: '#a78bfa', fontSize: '15px', fontWeight: 'bold' }}>🔀 Tùy chọn đoạn:</span>
                <span style={{ color: '#cbd5e1', fontSize: '14px' }}>Từ</span>
                <select className="btn-hover" value={customStartIdx} onChange={(e) => setCustomStartIdx(parseInt(e.target.value, 10))} style={{ padding: "6px 10px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", color: "#a855f7", border: "1px solid rgba(168, 85, 247, 0.3)", outline: "none", fontWeight: 'bold' }}>
                  {activeLesson.data.map((_, idx) => ( <option key={idx} value={idx} style={{color: '#000'}}>Câu {idx + 1}</option> ))}
                </select>
                <span style={{ color: '#cbd5e1', fontSize: '14px' }}>đến</span>
                <select className="btn-hover" value={customEndIdx} onChange={(e) => setCustomEndIdx(parseInt(e.target.value, 10))} style={{ padding: "6px 10px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", color: "#a855f7", border: "1px solid rgba(168, 85, 247, 0.3)", outline: "none", fontWeight: 'bold' }}>
                  {activeLesson.data.map((_, idx) => ( <option key={idx} value={idx} style={{color: '#000'}}>Câu {idx + 1}</option> ))}
                </select>
                <button className="btn-hover" onClick={() => playRange(customStartIdx, customEndIdx)} style={{ padding: "8px 18px", borderRadius: "8px", background: "linear-gradient(135deg, #a855f7, #7e22ce)", color: "#fff", border: "none", fontWeight: "bold", cursor: "pointer", boxShadow: '0 4px 10px rgba(126, 34, 206, 0.3)' }}>
                  ▶ Phát đoạn
                </button>
              </div>
              
              <div style={{ display: "flex", flexWrap: 'wrap', gap: "25px", alignItems: "center" }}>
                <label className="btn-hover" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "15px", color: "#34d399", fontWeight: 'bold', padding: '5px 10px', background: 'rgba(52, 211, 153, 0.1)', borderRadius: '8px' }}>
                  <input type="checkbox" checked={isAutoLoop} onChange={(e) => setIsAutoLoop(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
                  🔁 Tự động lặp
                </label>

                <label className="btn-hover" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "15px", color: "#fbbf24", fontWeight: 'bold', padding: '5px 10px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '8px' }}>
                  <input type="checkbox" checked={showFullScript} onChange={(e) => setShowFullScript(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
                  📜 Hiện Full Script (Karaoke)
                </label>

                <div style={{marginLeft: 'auto'}}>
                  <select className="btn-hover" value={playbackRate} onChange={(e) => setPlaybackRate(parseFloat(e.target.value))} style={{ padding: "8px 12px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", outline: "none", fontWeight: 'bold', cursor: 'pointer' }}>
                    <option value={0.75} style={{color: '#000'}}>🐢 0.75x (Chậm)</option>
                    <option value={0.85} style={{color: '#000'}}>🚶 0.85x</option>
                    <option value={1} style={{color: '#000'}}>🏃 1.0x (Chuẩn)</option>
                    <option value={1.25} style={{color: '#000'}}>🚀 1.25x</option>
                    <option value={1.5} style={{color: '#000'}}>🔥 1.5x (Nhanh)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* VÙNG LÀM VIỆC */}
            <div style={{ display: 'grid', gridTemplateColumns: showFullScript ? '1fr 1fr' : '1fr', gap: '25px', transition: 'all 0.4s ease' }}>
              
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
                  placeholder="Gõ đáp án vào đây... (Hệ thống tự động chấm điểm thời gian thực)"
                  style={{ width: "100%", height: "130px", fontSize: "18px", padding: "18px", borderRadius: "16px", border: isSuccess ? "2px solid #22c55e" : "2px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", color: "#fff", outline: "none", resize: "vertical", transition: "all 0.3s ease", boxShadow: isSuccess ? "0 0 25px rgba(34, 197, 94, 0.3), inset 0 0 10px rgba(34, 197, 94, 0.1)" : "inset 0 2px 4px rgba(0,0,0,0.3)" }}
                />

                <div style={{ display: "flex", gap: "15px", marginTop: "20px" }}>
                  <button 
                    className={`btn-hover ${isSuccess ? "pulse-btn" : ""}`}
                    onClick={isSuccess ? nextSentence : handleCheck} 
                    style={{ flex: 2, padding: "16px", fontSize: "18px", background: isSuccess ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "linear-gradient(135deg, #22c55e, #16a34a)", color: "white", border: "none", borderRadius: "12px", cursor: "pointer", fontWeight: "bold", textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                  >
                    {isSuccess ? "Câu Tiếp Theo ⮕ (Enter)" : "Kiểm tra lỗi ✓ (Enter)"}
                  </button>
                  {!isSuccess && (
                    <button className="btn-hover" onClick={handleSurrenderWord} style={{ flex: 1, padding: "16px", fontSize: "16px", background: "rgba(239, 68, 68, 0.1)", color: "#fca5a5", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "12px", cursor: "pointer", fontWeight: "bold" }}>
                      🏳️ Gợi ý 1 từ
                    </button>
                  )}
                </div>

                <div ref={resultBoxRef} className="glass-panel" style={{ marginTop: "25px", padding: "25px", borderRadius: "16px", minHeight: "130px", maxHeight: showFullScript ? "300px" : "350px", overflowY: "auto", position: 'relative' }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", fontSize: "22px", lineHeight: "1.8" }}>
                    {!showFeedback && <span style={{ color: "#64748b", fontStyle: "italic", fontSize: '18px' }}>Bản dịch sẽ tự động hiển thị khi bạn hoàn thành xuất sắc câu này...</span>}
                    
                    {showFeedback && currentSegment && currentSegment.transcript.split(/\s+/).filter(Boolean).map((word, i) => {
                      const userWords = input.trim().split(/\s+/).filter(Boolean);
                      const rawTranscriptWords = currentSegment.transcript.split(/\s+/).filter(Boolean);
                      let currentErrorIdx = -1;
                      for (let k = 0; k < rawTranscriptWords.length; k++) {
                        if (normalize(userWords[k]) !== normalize(rawTranscriptWords[k])) { currentErrorIdx = k; break; }
                      }
                      if (currentErrorIdx === -1 && userWords.length < rawTranscriptWords.length) currentErrorIdx = userWords.length;

                      if (i < currentErrorIdx || currentErrorIdx === -1) return <span key={i} style={{ color: "#34d399", fontWeight: "bold", textShadow: "0 0 8px rgba(52, 211, 153, 0.4)", transition: "color 0.3s" }}>{word}</span>;
                      
                      if (i === currentErrorIdx && !isSuccess) {
                        const attempts = attemptsPerWord[i] || 0;
                        const cleanWord = word.replace(/[^a-zA-Z0-9'’]/g, "");
                        const revealCount = Math.min(attempts > 0 ? attempts - 1 : 0, cleanWord.length);
                        let hintStr = cleanWord.substring(0, revealCount);
                        for (let j = revealCount; j < cleanWord.length; j++) hintStr += "_";
                        return (
                          <span className="pop-in" key={i} style={{ background: "rgba(220, 38, 38, 0.2)", border: "1px solid rgba(248, 113, 113, 0.5)", padding: "4px 12px", borderRadius: "8px", display: "inline-flex", alignItems: "center", gap: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                            {userWords[i] && <span style={{ color: "#f87171", textDecoration: "line-through", fontSize: "18px" }}>{userWords[i]}</span>}
                            <span style={{ color: "#fbbf24", fontFamily: "monospace", fontWeight: "bold", letterSpacing: "3px" }}>{hintStr}</span>
                          </span>
                        );
                      }
                      return <span key={i} style={{ color: "#475569", transition: "color 0.3s" }}>___</span>;
                    })}
                  </div>
                  
                  {/* HIỆU ỨNG THÀNH CÔNG BAY LƠ LỬNG */}
                  {isSuccess && (
                    <div className="pop-in" style={{ marginTop: "25px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "20px" }}>
                      <p className="floating" style={{ color: "#34d399", fontWeight: "900", fontSize: "22px", margin: "0 0 15px 0", display: 'inline-block' }}>
                        <span style={{fontSize: '26px', marginRight: '8px'}}>🎉</span> Hoàn hảo! Xuất sắc!
                      </p>
                      <div style={{ background: 'rgba(139, 92, 246, 0.1)', borderLeft: '4px solid #8b5cf6', padding: '15px', borderRadius: '0 8px 8px 0' }}>
                        <p style={{ color: "#c4b5fd", fontStyle: "italic", margin: 0, fontSize: '18px', lineHeight: '1.6' }}>
                          <span style={{opacity: 0.7, marginRight: '5px'}}>🇻🇳 Dịch:</span> {currentSegment?.translation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* CỘT 2: FULL SCRIPT (KARAOKE) */}
              {showFullScript && (
                <div className="fade-in glass-panel" style={{ borderRadius: "16px", padding: "20px", maxHeight: "450px", overflowY: "auto", display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ position: 'sticky', top: '-20px', background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)', padding: '15px 0 10px 0', marginBottom: '10px', zIndex: 10, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <h4 style={{ margin: 0, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
                      <span style={{fontSize: '22px'}}>📜</span> Script Tracker (Karaoke)
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
                          padding: '12px 15px',
                          borderRadius: '10px',
                          fontSize: '18px',
                          lineHeight: '1.6',
                          color: isPlaying ? '#0f172a' : '#cbd5e1',
                          background: isPlaying ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' : 'rgba(255,255,255,0.03)',
                          fontWeight: isPlaying ? 'bold' : 'normal',
                          transform: isPlaying ? 'scale(1.02)' : 'scale(1)',
                          boxShadow: isPlaying ? '0 4px 15px rgba(245, 158, 11, 0.3)' : 'none',
                          borderLeft: isPlaying ? 'none' : '3px solid transparent',
                          cursor: 'pointer'
                        }}
                        onClick={() => playRange(idx, idx)}
                      >
                        <span style={{ fontSize: '12px', marginRight: '10px', opacity: isPlaying ? 0.8 : 0.4, background: isPlaying ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
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

        {/* ================= TAB 3: SỔ TỪ VỰNG ================= */}
        {activeTab === "VOCAB" && (
          <div className="fade-in glass-panel" style={{ padding: "30px", borderRadius: "16px" }}>
            <h3 style={{ color: "#a855f7", marginTop: 0, fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>➕</span> Thêm từ mới vào bộ nhớ
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "40px", background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px' }}>
              <input value={newVocab.word} onChange={(e) => setNewVocab({ ...newVocab, word: e.target.value })} placeholder="Từ vựng (VD: Circadian rhythm)" style={{ padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: "16px", outline: 'none' }} />
              <input value={newVocab.meaning} onChange={(e) => setNewVocab({ ...newVocab, meaning: e.target.value })} placeholder="Định nghĩa (VD: Nhịp sinh học)" style={{ padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: "16px", outline: 'none' }} />
              <textarea value={newVocab.example} onChange={(e) => setNewVocab({ ...newVocab, example: e.target.value })} placeholder="Câu ví dụ (VD: Sunlight affects our circadian rhythm.)" style={{ padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: "16px", height: "90px", resize: "vertical", outline: 'none' }} />
              <button className="btn-hover" onClick={saveVocab} style={{ padding: "14px", background: "linear-gradient(135deg, #a855f7, #7e22ce)", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "bold", fontSize: "18px", cursor: "pointer", marginTop: '5px', boxShadow: '0 4px 10px rgba(168, 85, 247, 0.3)' }}>
                💾 Lưu Vào Sổ Tay
              </button>
            </div>

            <h3 style={{ color: "#38bdf8", fontSize: '22px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>📚 Danh sách từ vựng của bạn ({vocabList.length} từ)</h3>
            {vocabList.length === 0 ? (
              <p style={{ color: "#64748b", fontStyle: "italic", textAlign: 'center', padding: '20px' }}>Bạn chưa lưu từ vựng nào. Hãy chăm chỉ note lại các từ mới nhé!</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px", marginTop: '20px' }}>
                {vocabList.map((v) => (
                  <div className="btn-hover" key={v.id} style={{ background: "rgba(0,0,0,0.3)", padding: "20px", borderRadius: "12px", borderTop: "4px solid #a855f7", position: "relative", boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}>
                    <button onClick={() => deleteVocab(v.id)} style={{ position: "absolute", top: "10px", right: "10px", background: "rgba(239, 68, 68, 0.1)", border: "none", color: "#ef4444", width: '30px', height: '30px', borderRadius: '50%', fontSize: "14px", cursor: "pointer", display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseOver={(e) => {e.target.style.background = "#ef4444"; e.target.style.color = "#fff"}} onMouseOut={(e) => {e.target.style.background = "rgba(239, 68, 68, 0.1)"; e.target.style.color = "#ef4444"}}>✖</button>
                    <p style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "bold", color: "#f8fafc", paddingRight: '20px' }}>{v.word}</p>
                    <p style={{ margin: "0 0 12px 0", color: "#38bdf8", fontSize: "16px", background: 'rgba(56, 189, 248, 0.1)', display: 'inline-block', padding: '4px 10px', borderRadius: '6px' }}>{v.meaning}</p>
                    {v.example && (
                      <div style={{ borderLeft: '2px solid #64748b', paddingLeft: '10px' }}>
                        <p style={{ margin: 0, fontStyle: "italic", color: "#cbd5e1", fontSize: "14px", lineHeight: '1.5' }}>"{v.example}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}