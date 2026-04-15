import React, { useState, useRef, useCallback, useEffect } from "react";

// --- BỘ LỌC TỪ VIẾT TẮT THÔNG MINH ---
const expandContractions = (str) => {
  let s = str?.toLowerCase() || "";
  // Cập nhật bộ từ điển để tự nhận diện viết tắt không có dấu '
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
    "we're": "we are", // Bỏ "were" để tránh nhầm với thì quá khứ của are
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
    "we'll": "we will", // Bỏ "well" để tránh nhầm với từ well (tốt/khỏe)
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

export default function App() {
  // --- STATE HỆ THỐNG ---
  const [library, setLibrary] = useState([]);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [sessionAudioUrls, setSessionAudioUrls] = useState({});
  const [newAudioUrl, setNewAudioUrl] = useState(null);
  const [newJsonData, setNewJsonData] = useState(null);
  const [newFileName, setNewFileName] = useState("");

  // --- STATE HỌC TẬP ---
  const [input, setInput] = useState("");
  const [attemptsPerWord, setAttemptsPerWord] = useState({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState("LIBRARY");

  // --- STATE LƯU CÂU KHÓ (TÍNH NĂNG MỚI) ---
  const [savedSentences, setSavedSentences] = useState([]);

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
  const [newVocab, setNewVocab] = useState({
    word: "",
    meaning: "",
    example: "",
  });

  // 1. KHỞI TẠO VÀ LƯU TRỮ
  useEffect(() => {
    const savedVocab = localStorage.getItem("my_vocab_book");
    if (savedVocab) setVocabList(JSON.parse(savedVocab));
    const savedLibrary = localStorage.getItem("my_dictation_library");
    if (savedLibrary) setLibrary(JSON.parse(savedLibrary));
    const savedFavs = localStorage.getItem("my_saved_sentences");
    if (savedFavs) setSavedSentences(JSON.parse(savedFavs));
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
    () =>
      localStorage.setItem(
        "my_saved_sentences",
        JSON.stringify(savedSentences)
      ),
    [savedSentences]
  );

  useEffect(() => {
    if (showFeedback && resultBoxRef.current) {
      resultBoxRef.current.scrollTop = resultBoxRef.current.scrollHeight;
    }
  }, [input, showFeedback]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // ==========================================
  // LẤY DỮ LIỆU BÀI HIỆN TẠI
  // ==========================================
  const activeLesson = library.find((l) => l.id === activeLessonId);
  const currentSegment = activeLesson
    ? activeLesson.data[activeLesson.currentIdx]
    : null;
  const currentAudioUrl = sessionAudioUrls[activeLessonId];

  // Kiểm tra xem câu hiện tại đã được lưu chưa
  const currentSentenceId = activeLesson
    ? `${activeLesson.id}_${activeLesson.currentIdx}`
    : "";
  const isCurrentSaved = savedSentences.some((s) => s.id === currentSentenceId);

  // ==========================================
  // AUTO-CHECK THỜI GIAN THỰC
  // ==========================================
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
  // PHÁT NHẠC TÙY CHỈNH KHOẢNG CÁCH
  // ==========================================
  const playRange = useCallback(
    (startIdx, endIdx) => {
      if (!audioRef.current || !activeLesson) return;
      const startSegment = activeLesson.data[startIdx];
      const endSegment = activeLesson.data[endIdx];
      if (!startSegment || !endSegment) return;

      clearInterval(timerRef.current);
      audioRef.current.currentTime = startSegment.start_time;
      audioRef.current.play().catch((e) => console.log("Lỗi:", e));

      timerRef.current = setInterval(() => {
        if (audioRef.current.currentTime >= endSegment.end_time) {
          if (isAutoLoop && !isSuccess && startIdx === endIdx) {
            audioRef.current.currentTime = startSegment.start_time;
            audioRef.current.play();
          } else {
            audioRef.current.pause();
            clearInterval(timerRef.current);
          }
        }
      }, 100);
    },
    [activeLesson, isAutoLoop, isSuccess]
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
  // CHUYỂN CÂU
  // ==========================================
  const resetDictationState = () => {
    setInput("");
    setAttemptsPerWord({});
    setShowFeedback(false);
    setIsSuccess(false);
  };

  const updateProgress = (lessonId, newIdx) => {
    setLibrary((prev) =>
      prev.map((lesson) =>
        lesson.id === lessonId ? { ...lesson, currentIdx: newIdx } : lesson
      )
    );
  };

  const jumpToSentence = (newIdx) => {
    if (!activeLesson) return;
    updateProgress(activeLesson.id, newIdx);
    resetDictationState();
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
    if (
      activeLesson &&
      activeLesson.currentIdx < activeLesson.data.length - 1
    ) {
      isTransitioning.current = true;
      jumpToSentence(activeLesson.currentIdx + 1);
      setTimeout(() => {
        isTransitioning.current = false;
      }, 500);
    } else {
      alert("🎉 Bạn đã hoàn thành toàn bộ bài nghe này!");
    }
  };

  // ==========================================
  // HÀNH ĐỘNG TẠO / XÓA BÀI & LƯU CÂU
  // ==========================================
  const handleNewAudioUpload = (e) => {
    if (e.target.files[0])
      setNewAudioUrl(URL.createObjectURL(e.target.files[0]));
  };
  const handleNewJsonUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewFileName(file.name.replace(".json", "")); // Lấy mặc định làm tên nhưng user có thể sửa
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          setNewJsonData(JSON.parse(event.target.result));
        } catch (error) {
          alert("Lỗi đọc file JSON!");
        }
      };
      reader.readAsText(file);
    }
  };

  const createNewLesson = () => {
    if (!newJsonData || !newAudioUrl) return;
    const newLesson = {
      id: Date.now().toString(),
      name: newFileName || "Bài học mới", // Sử dụng tên đã được chỉnh sửa
      data: newJsonData,
      currentIdx: 0,
    };
    setLibrary((prev) => [newLesson, ...prev]);
    setSessionAudioUrls((prev) => ({ ...prev, [newLesson.id]: newAudioUrl }));
    setNewJsonData(null);
    setNewAudioUrl(null);
    setNewFileName("");
    setActiveLessonId(newLesson.id);
    setActiveTab("DICTATION");
    resetDictationState();
  };

  const deleteLesson = (id) => {
    if (
      window.confirm(
        "Bạn có chắc muốn xóa bài học này khỏi thư viện? Các câu lưu của bài này cũng sẽ bị xóa."
      )
    ) {
      setLibrary((prev) => prev.filter((l) => l.id !== id));
      setSavedSentences((prev) => prev.filter((s) => s.lessonId !== id)); // Xóa luôn câu đã lưu của bài này
      if (activeLessonId === id) {
        setActiveLessonId(null);
        setActiveTab("LIBRARY");
      }
    }
  };

  // Nút bấm Lưu / Hủy lưu câu khó
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

  // Nhảy từ danh sách đã lưu về thẳng bài nghe
  const playSavedSentence = (lessonId, sentenceIdx) => {
    if (!sessionAudioUrls[lessonId]) {
      alert(
        "Bài học này chưa được kết nối Audio trong phiên làm việc. Vui lòng quay lại Thư viện và bấm 'Học tiếp' để kết nối MP3 trước."
      );
      setActiveTab("LIBRARY");
      return;
    }
    setActiveLessonId(lessonId);
    updateProgress(lessonId, sentenceIdx);
    resetDictationState();
    setActiveTab("DICTATION");
    autoPlayRef.current = true;
  };

  const removeSavedSentence = (id) => {
    setSavedSentences((prev) => prev.filter((s) => s.id !== id));
  };

  // ==========================================
  // KIỂM TRA ĐÁP ÁN (DICTATION LOGIC)
  // ==========================================
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
    let errorIdx = -1;
    for (let i = 0; i < transcriptWords.length; i++) {
      if (userWords[i] !== transcriptWords[i]) {
        errorIdx = i;
        break;
      }
    }
    if (errorIdx === -1 && userWords.length < transcriptWords.length)
      errorIdx = userWords.length;

    setAttemptsPerWord((prev) => ({
      ...prev,
      [errorIdx]: (prev[errorIdx] || 0) + 1,
    }));
    setIsSuccess(false);
    setShowFeedback(true);
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

  // ==========================================
  // RENDER GIAO DIỆN CHÍNH
  // ==========================================
  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "1000px",
        margin: "0 auto",
        fontFamily: "sans-serif",
        backgroundColor: "#0f172a",
        color: "#e2e8f0",
        minHeight: "100vh",
      }}
    >
      {/* TABS HEADER CHÍNH */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          borderBottom: "2px solid #334155",
          paddingBottom: "10px",
          marginBottom: "20px",
        }}
      >
        <button
          onClick={() => setActiveTab("LIBRARY")}
          style={{
            flex: 1,
            minWidth: "120px",
            padding: "12px",
            fontSize: "16px",
            fontWeight: "bold",
            background: activeTab === "LIBRARY" ? "#10b981" : "transparent",
            color: activeTab === "LIBRARY" ? "#0f172a" : "#94a3b8",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.3s",
          }}
        >
          📚 Thư Viện ({library.length})
        </button>
        <button
          onClick={() => {
            if (activeLessonId) setActiveTab("DICTATION");
            else alert("Vui lòng chọn 1 bài học từ Thư Viện trước!");
          }}
          style={{
            flex: 1,
            minWidth: "120px",
            padding: "12px",
            fontSize: "16px",
            fontWeight: "bold",
            background: activeTab === "DICTATION" ? "#38bdf8" : "transparent",
            color: activeTab === "DICTATION" ? "#0f172a" : "#94a3b8",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.3s",
            opacity: activeLessonId ? 1 : 0.5,
          }}
        >
          🎧 Luyện Nghe
        </button>
        <button
          onClick={() => setActiveTab("SAVED")}
          style={{
            flex: 1,
            minWidth: "120px",
            padding: "12px",
            fontSize: "16px",
            fontWeight: "bold",
            background: activeTab === "SAVED" ? "#f59e0b" : "transparent",
            color: activeTab === "SAVED" ? "#fff" : "#94a3b8",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.3s",
          }}
        >
          ⭐ Câu Đã Lưu ({savedSentences.length})
        </button>
        <button
          onClick={() => setActiveTab("VOCAB")}
          style={{
            flex: 1,
            minWidth: "120px",
            padding: "12px",
            fontSize: "16px",
            fontWeight: "bold",
            background: activeTab === "VOCAB" ? "#a855f7" : "transparent",
            color: activeTab === "VOCAB" ? "#fff" : "#94a3b8",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.3s",
          }}
        >
          📖 Sổ Từ ({vocabList.length})
        </button>
      </div>

      {/* ================= TAB 1: THƯ VIỆN ================= */}
      {activeTab === "LIBRARY" && (
        <div>
          <div
            style={{
              background: "#1e293b",
              padding: "20px",
              borderRadius: "12px",
              marginBottom: "30px",
              border: "2px dashed #334155",
            }}
          >
            <h3 style={{ color: "#38bdf8", marginTop: 0 }}>
              ➕ Thêm Bài Học Mới
            </h3>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "15px",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1, minWidth: "200px" }}>
                <p
                  style={{
                    margin: "0 0 5px 0",
                    fontSize: "14px",
                    color: "#94a3b8",
                  }}
                >
                  1. Audio (.mp3)
                </p>
                <input
                  type="file"
                  accept=".mp3, .wav, audio/mp3, audio/wav, audio/*"
                  onChange={handleNewAudioUpload}
                  style={{
                    color: "#fff",
                    padding: "8px",
                    background: "#0f172a",
                    borderRadius: "6px",
                    width: "100%",
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <p
                  style={{
                    margin: "0 0 5px 0",
                    fontSize: "14px",
                    color: "#94a3b8",
                  }}
                >
                  2. Script (.json)
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleNewJsonUpload}
                  style={{
                    color: "#fff",
                    padding: "8px",
                    background: "#0f172a",
                    borderRadius: "6px",
                    width: "100%",
                  }}
                />
              </div>

              {/* TÍNH NĂNG MỚI: CHO PHÉP ĐỔI TÊN BÀI HỌC */}
              <div style={{ flex: 1, minWidth: "200px" }}>
                <p
                  style={{
                    margin: "0 0 5px 0",
                    fontSize: "14px",
                    color: "#94a3b8",
                  }}
                >
                  3. Tên bài học (Sửa tùy ý)
                </p>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="Nhập tên dễ nhớ..."
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #334155",
                    background: "#0f172a",
                    color: "#fff",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <button
              onClick={createNewLesson}
              disabled={!newJsonData || !newAudioUrl}
              style={{
                marginTop: "20px",
                padding: "12px 20px",
                background:
                  !newJsonData || !newAudioUrl ? "#334155" : "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "bold",
                cursor:
                  !newJsonData || !newAudioUrl ? "not-allowed" : "pointer",
                width: "100%",
              }}
            >
              Tạo và Học Ngay 🚀
            </button>
          </div>

          <h3 style={{ color: "#e2e8f0" }}>📂 Các bài học đang theo dõi</h3>
          {library.length === 0 ? (
            <p style={{ color: "#64748b", fontStyle: "italic" }}>
              Thư viện của bạn đang trống.
            </p>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              {library.map((lesson) => (
                <div
                  key={lesson.id}
                  style={{
                    background: "#1e293b",
                    padding: "20px",
                    borderRadius: "12px",
                    borderLeft: "4px solid #38bdf8",
                    position: "relative",
                  }}
                >
                  <button
                    onClick={() => deleteLesson(lesson.id)}
                    style={{
                      position: "absolute",
                      top: "15px",
                      right: "15px",
                      background: "transparent",
                      border: "none",
                      color: "#ef4444",
                      fontSize: "16px",
                      cursor: "pointer",
                    }}
                  >
                    🗑 Xóa
                  </button>
                  <h3 style={{ margin: "0 0 10px 0", color: "#fff" }}>
                    {lesson.name}
                  </h3>
                  <div
                    style={{
                      background: "#0f172a",
                      borderRadius: "8px",
                      height: "8px",
                      overflow: "hidden",
                      marginBottom: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: `${
                          (lesson.currentIdx / lesson.data.length) * 100
                        }%`,
                        height: "100%",
                        background: "#10b981",
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
                    Tiến độ: Câu {lesson.currentIdx + 1} / {lesson.data.length}
                  </p>

                  {sessionAudioUrls[lesson.id] ? (
                    <button
                      onClick={() => {
                        setActiveLessonId(lesson.id);
                        setActiveTab("DICTATION");
                        resetDictationState();
                      }}
                      style={{
                        padding: "10px 20px",
                        background: "#3b82f6",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      ▶ Học tiếp
                    </button>
                  ) : (
                    <div
                      style={{
                        background: "#334155",
                        padding: "10px",
                        borderRadius: "8px",
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 8px 0",
                          fontSize: "13px",
                          color: "#fca5a5",
                        }}
                      >
                        ⚠ Cần liên kết lại file MP3 để học tiếp:
                      </p>
                      <input
                        type="file"
                        accept=".mp3, .wav, audio/*"
                        onChange={(e) => {
                          if (e.target.files[0])
                            setSessionAudioUrls((prev) => ({
                              ...prev,
                              [lesson.id]: URL.createObjectURL(
                                e.target.files[0]
                              ),
                            }));
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

      {/* ================= TAB 2: LUYỆN NGHE (DICTATION) ================= */}
      {activeTab === "DICTATION" && activeLesson && (
        <>
          <audio ref={audioRef} src={currentAudioUrl} />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "15px",
            }}
          >
            <span
              style={{ fontSize: "18px", color: "#e2e8f0", fontWeight: "bold" }}
            >
              {activeLesson.name}
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "15px", color: "#94a3b8" }}>Câu</span>
              <select
                value={activeLesson.currentIdx}
                onChange={(e) => jumpToSentence(parseInt(e.target.value, 10))}
                style={{
                  padding: "6px 10px",
                  borderRadius: "8px",
                  background: "#1e293b",
                  color: "#38bdf8",
                  border: "1px solid #334155",
                  fontSize: "16px",
                  fontWeight: "bold",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {activeLesson.data.map((_, idx) => (
                  <option key={idx} value={idx}>
                    {idx + 1}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: "15px", color: "#94a3b8" }}>
                / {activeLesson.data.length}
              </span>

              {/* TÍNH NĂNG MỚI: NÚT LƯU CÂU KHÓ */}
              <button
                onClick={toggleSaveSentence}
                title="Lưu câu này vào danh sách ôn tập"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "24px",
                  padding: "0 5px",
                  color: isCurrentSaved ? "#f59e0b" : "#64748b",
                  transition: "transform 0.2s",
                  transform: isCurrentSaved ? "scale(1.1)" : "scale(1)",
                }}
              >
                {isCurrentSaved ? "⭐" : "☆"}
              </button>
            </div>
          </div>

          <div
            style={{
              background: "#1e293b",
              padding: "15px",
              borderRadius: "12px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "15px",
              }}
            >
              <button
                onClick={playSegment}
                style={{
                  padding: "10px 15px",
                  borderRadius: "8px",
                  background: "#38bdf8",
                  color: "#0f172a",
                  border: "none",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                ▶ Phát câu này
              </button>
              <button
                onClick={() =>
                  playRange(
                    Math.max(0, activeLesson.currentIdx - 1),
                    activeLesson.currentIdx
                  )
                }
                style={{
                  padding: "10px 15px",
                  borderRadius: "8px",
                  background: "#475569",
                  color: "#fff",
                  border: "1px solid #64748b",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                🔗 Nối câu (n-1)
              </button>
              <button
                onClick={() => playRange(0, activeLesson.currentIdx)}
                style={{
                  padding: "10px 15px",
                  borderRadius: "8px",
                  background: "#475569",
                  color: "#fff",
                  border: "1px solid #64748b",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                ⏮ Nghe từ câu 1
              </button>
              <button
                onClick={rewindAudio}
                style={{
                  padding: "10px 15px",
                  borderRadius: "8px",
                  background: "#334155",
                  color: "#e2e8f0",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ⏪ Lùi 2s
              </button>
            </div>

            <div
              style={{
                display: "flex",
                gap: "15px",
                alignItems: "center",
                borderTop: "1px solid #334155",
                paddingTop: "10px",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: "#94a3b8",
                }}
              >
                <input
                  type="checkbox"
                  checked={isAutoLoop}
                  onChange={(e) => setIsAutoLoop(e.target.checked)}
                />
                🔁 Tự lặp (chỉ áp dụng Phát câu này)
              </label>
              <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                style={{
                  padding: "6px",
                  borderRadius: "6px",
                  background: "#0f172a",
                  color: "#38bdf8",
                  border: "1px solid #334155",
                  outline: "none",
                }}
              >
                <option value={0.75}>🐢 0.75x</option>
                <option value={0.85}>🚶 0.85x</option>
                <option value={1}>🏃 1.0x</option>
                <option value={1.25}>🚀 1.25x</option>
                <option value={1.5}>🔥 1.5x</option>
              </select>
            </div>
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                isSuccess ? nextSentence() : handleCheck();
              }
            }}
            placeholder="Gõ đáp án vào đây... (Hệ thống tự động chấm điểm thông minh)"
            style={{
              width: "100%",
              height: "100px",
              fontSize: "18px",
              padding: "15px",
              borderRadius: "12px",
              border: isSuccess ? "2px solid #22c55e" : "2px solid #334155",
              background: "#1e293b",
              color: "#fff",
              outline: "none",
              resize: "vertical",
              transition: "border 0.3s",
            }}
          />

          <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
            <button
              onClick={isSuccess ? nextSentence : handleCheck}
              style={{
                flex: 2,
                padding: "15px",
                fontSize: "18px",
                background: isSuccess ? "#3b82f6" : "#22c55e",
                color: "white",
                border: "none",
                borderRadius: "12px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              {isSuccess
                ? "Tiếp tục ⮕ (Hoặc nhấn Enter)"
                : "Kiểm tra lỗi ✓ (Enter)"}
            </button>
            {!isSuccess && (
              <button
                onClick={handleSurrenderWord}
                style={{
                  flex: 1,
                  padding: "15px",
                  fontSize: "16px",
                  background: "#334155",
                  color: "#fca5a5",
                  border: "none",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                🏳️ Cho xin 1 từ
              </button>
            )}
          </div>

          <div
            ref={resultBoxRef}
            style={{
              marginTop: "20px",
              border: "2px solid #334155",
              padding: "20px",
              borderRadius: "12px",
              background: "#1e293b",
              minHeight: "120px",
              maxHeight: "300px",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                fontSize: "20px",
                lineHeight: "1.8",
              }}
            >
              {!showFeedback && (
                <span style={{ color: "#64748b", fontStyle: "italic" }}>
                  Bản dịch sẽ tự động hiện khi bạn hoàn thành câu...
                </span>
              )}

              {showFeedback &&
                currentSegment &&
                currentSegment.transcript
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((word, i) => {
                    const userWords = input.trim().split(/\s+/).filter(Boolean);
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

                    if (i < currentErrorIdx || currentErrorIdx === -1) {
                      return (
                        <span
                          key={i}
                          style={{ color: "#22c55e", fontWeight: "bold" }}
                        >
                          {word}
                        </span>
                      );
                    }
                    if (i === currentErrorIdx && !isSuccess) {
                      const attempts = attemptsPerWord[i] || 0;
                      const cleanWord = word.replace(/[^a-zA-Z0-9'’]/g, "");
                      const revealCount = Math.min(
                        attempts > 0 ? attempts - 1 : 0,
                        cleanWord.length
                      );
                      let hintStr = cleanWord.substring(0, revealCount);
                      for (let j = revealCount; j < cleanWord.length; j++)
                        hintStr += "_";
                      const wrongUserWord = userWords[i];

                      return (
                        <span
                          key={i}
                          style={{
                            background: "#450a0a",
                            border: "1px solid #f87171",
                            padding: "2px 10px",
                            borderRadius: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          {wrongUserWord && (
                            <span
                              style={{
                                color: "#ef4444",
                                textDecoration: "line-through",
                                fontSize: "16px",
                              }}
                            >
                              {wrongUserWord}
                            </span>
                          )}
                          <span
                            style={{
                              color: "#fbbf24",
                              fontFamily: "monospace",
                              fontWeight: "bold",
                              letterSpacing: "2px",
                            }}
                          >
                            {hintStr}
                          </span>
                        </span>
                      );
                    }
                    if (i > currentErrorIdx)
                      return (
                        <span key={i} style={{ color: "#475569" }}>
                          ___
                        </span>
                      );
                    return null;
                  })}
            </div>

            {isSuccess && (
              <div
                style={{
                  marginTop: "20px",
                  borderTop: "2px dashed #475569",
                  paddingTop: "15px",
                }}
              >
                <p
                  style={{
                    color: "#22c55e",
                    fontWeight: "bold",
                    fontSize: "18px",
                  }}
                >
                  🎉 Hoàn hảo!
                </p>
                <p
                  style={{
                    color: "#a78bfa",
                    fontStyle: "italic",
                    marginBottom: "10px",
                  }}
                >
                  🇻🇳 Dịch: {currentSegment?.translation}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ================= TAB MỚI: DANH SÁCH CÂU ĐÃ LƯU ================= */}
      {activeTab === "SAVED" && (
        <div
          style={{
            background: "#1e293b",
            padding: "20px",
            borderRadius: "12px",
          }}
        >
          <h3
            style={{
              color: "#f59e0b",
              marginTop: 0,
              borderBottom: "1px solid #334155",
              paddingBottom: "10px",
            }}
          >
            ⭐ Danh Sách Ôn Tập ({savedSentences.length} câu)
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
              Bạn chưa lưu câu nào. Khi đang luyện nghe, hãy bấm vào biểu tượng
              ngôi sao (☆) góc phải để lưu câu khó vào đây nhé!
            </p>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              {savedSentences.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: "#0f172a",
                    padding: "15px",
                    borderRadius: "10px",
                    borderLeft: "4px solid #f59e0b",
                    position: "relative",
                  }}
                >
                  <button
                    onClick={() => removeSavedSentence(item.id)}
                    style={{
                      position: "absolute",
                      top: "15px",
                      right: "15px",
                      background: "transparent",
                      border: "none",
                      color: "#ef4444",
                      fontSize: "18px",
                      cursor: "pointer",
                    }}
                    title="Xóa khỏi danh sách"
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
                    🎧 Tới bài học & Nghe lại
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 4: SỔ TỪ VỰNG ================= */}
      {activeTab === "VOCAB" && (
        <div
          style={{
            background: "#1e293b",
            padding: "20px",
            borderRadius: "12px",
          }}
        >
          <h3 style={{ color: "#a855f7", marginTop: 0 }}>➕ Thêm từ mới</h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              marginBottom: "30px",
            }}
          >
            <input
              value={newVocab.word}
              onChange={(e) =>
                setNewVocab({ ...newVocab, word: e.target.value })
              }
              placeholder="Từ vựng (VD: Melatonin)"
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #334155",
                background: "#0f172a",
                color: "#fff",
                fontSize: "16px",
              }}
            />
            <input
              value={newVocab.meaning}
              onChange={(e) =>
                setNewVocab({ ...newVocab, meaning: e.target.value })
              }
              placeholder="Định nghĩa (VD: Hormone gây buồn ngủ)"
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #334155",
                background: "#0f172a",
                color: "#fff",
                fontSize: "16px",
              }}
            />
            <textarea
              value={newVocab.example}
              onChange={(e) =>
                setNewVocab({ ...newVocab, example: e.target.value })
              }
              placeholder="Câu ví dụ (VD: Melatonin helps us sleep.)"
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #334155",
                background: "#0f172a",
                color: "#fff",
                fontSize: "16px",
                height: "80px",
                resize: "vertical",
              }}
            />
            <button
              onClick={saveVocab}
              style={{
                padding: "12px",
                background: "#a855f7",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "bold",
                fontSize: "16px",
                cursor: "pointer",
              }}
            >
              Lưu vào sổ 💾
            </button>
          </div>

          <h3
            style={{
              color: "#38bdf8",
              borderBottom: "1px solid #334155",
              paddingBottom: "10px",
            }}
          >
            📚 Danh sách từ vựng của bạn
          </h3>
          {vocabList.length === 0 ? (
            <p style={{ color: "#64748b", fontStyle: "italic" }}>
              Chưa có từ vựng nào được lưu.
            </p>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              {vocabList.map((v) => (
                <div
                  key={v.id}
                  style={{
                    background: "#0f172a",
                    padding: "15px",
                    borderRadius: "8px",
                    borderLeft: "4px solid #a855f7",
                    position: "relative",
                  }}
                >
                  <button
                    onClick={() => deleteVocab(v.id)}
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      background: "transparent",
                      border: "none",
                      color: "#ef4444",
                      fontSize: "18px",
                      cursor: "pointer",
                    }}
                  >
                    ✖
                  </button>
                  <p
                    style={{
                      margin: "0 0 5px 0",
                      fontSize: "18px",
                      fontWeight: "bold",
                      color: "#e2e8f0",
                      paddingRight: "20px",
                    }}
                  >
                    {v.word}
                  </p>
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      color: "#38bdf8",
                      fontSize: "15px",
                    }}
                  >
                    {v.meaning}
                  </p>
                  {v.example && (
                    <p
                      style={{
                        margin: 0,
                        fontStyle: "italic",
                        color: "#94a3b8",
                        fontSize: "14px",
                      }}
                    >
                      Ví dụ: "{v.example}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
