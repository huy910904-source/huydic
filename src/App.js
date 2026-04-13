import React, { useState, useRef, useCallback, useEffect } from "react";

// --- BỘ LỌC TỪ VIẾT TẮT ---
const expandContractions = (str) => {
  let s = str?.toLowerCase() || "";
  const map = {
    "i'm": "i am",
    "can't": "cannot",
    "won't": "will not",
    "don't": "do not",
    "doesn't": "does not",
    "didn't": "did not",
    "isn't": "is not",
    "aren't": "are not",
    "haven't": "have not",
    "hasn't": "has not",
    "it's": "it is",
    "that's": "that is",
    "there's": "there is",
    "what's": "what is",
    "he's": "he is",
    "she's": "she is",
    "you're": "you are",
    "we're": "we are",
    "they're": "they are",
    "i've": "i have",
    "you've": "you have",
    "we've": "we have",
    "they've": "they have",
    "i'll": "i will",
    "you'll": "you will",
    "we'll": "we will",
    "they'll": "they will",
    "i'd": "i would",
    "you'd": "you would",
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

  // --- AUDIO CONTROLS & REFS ---
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isAutoLoop, setIsAutoLoop] = useState(false);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const resultBoxRef = useRef(null);
  const isTransitioning = useRef(false);
  const autoPlayRef = useRef(false); // Cờ báo hiệu tự động phát an toàn

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
  }, []);

  useEffect(
    () => localStorage.setItem("my_vocab_book", JSON.stringify(vocabList)),
    [vocabList]
  );
  useEffect(
    () => localStorage.setItem("my_dictation_library", JSON.stringify(library)),
    [library]
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
  // BẢN VÁ LỖI KẸT CÂU (TRANSITION ENGINE)
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

  // Hàm chuyển câu đa năng (dùng cho cả nút Next và Dropdown)
  const jumpToSentence = (newIdx) => {
    if (!activeLesson) return;
    updateProgress(activeLesson.id, newIdx);
    resetDictationState();
    autoPlayRef.current = true; // Kích hoạt cờ tự động phát
  };

  // Khi component nhận diện dữ liệu câu mới đã nạp xong, nó mới phát nhạc
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
      }, 500); // Mở khóa sau 0.5s
    } else {
      alert("🎉 Bạn đã hoàn thành toàn bộ bài nghe này!");
    }
  };

  // --- CÁC HÀM XỬ LÝ KHÁC ---
  const handleNewAudioUpload = (e) => {
    if (e.target.files[0])
      setNewAudioUrl(URL.createObjectURL(e.target.files[0]));
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
      name: newFileName || "Bài học mới",
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
    if (window.confirm("Bạn có chắc muốn xóa bài học này khỏi thư viện?")) {
      setLibrary((prev) => prev.filter((l) => l.id !== id));
      if (activeLessonId === id) {
        setActiveLessonId(null);
        setActiveTab("LIBRARY");
      }
    }
  };

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
        maxWidth: "900px",
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
          onClick={() => setActiveTab("VOCAB")}
          style={{
            flex: 1,
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: "15px" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <p
                  style={{
                    margin: "0 0 5px 0",
                    fontSize: "14px",
                    color: "#94a3b8",
                  }}
                >
                  1. Tải lên Audio (.mp3)
                </p>
                <input
                  type="file"
                  accept=".mp3, .wav, audio/mp3, audio/wav, audio/*"
                  onChange={handleNewAudioUpload}
                  style={{ color: "#fff" }}
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
                  2. Tải lên Script (.json)
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleNewJsonUpload}
                  style={{ color: "#fff" }}
                />
              </div>
            </div>
            <button
              onClick={createNewLesson}
              disabled={!newJsonData || !newAudioUrl}
              style={{
                marginTop: "15px",
                padding: "12px 20px",
                background:
                  !newJsonData || !newAudioUrl ? "#334155" : "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "bold",
                cursor:
                  !newJsonData || !newAudioUrl ? "not-allowed" : "pointer",
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
                        accept=".mp3, .wav, audio/mp3, audio/wav, audio/*"
                        onChange={(e) => {
                          if (e.target.files[0]) {
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
              style={{ fontSize: "16px", color: "#94a3b8", fontWeight: "bold" }}
            >
              {activeLesson.name}
            </span>

            {/* THAY ĐỔI: TẠO DROPDOWN CHỌN CÂU */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "16px",
                  color: "#e2e8f0",
                  fontWeight: "bold",
                }}
              >
                Câu
              </span>
              <select
                value={activeLesson.currentIdx}
                onChange={(e) => jumpToSentence(parseInt(e.target.value, 10))}
                style={{
                  padding: "6px 12px",
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
              <span
                style={{
                  fontSize: "16px",
                  color: "#94a3b8",
                  fontWeight: "bold",
                }}
              >
                / {activeLesson.data.length}
              </span>
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
                🔗 Nối câu trước (n-1)
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
            placeholder="Gõ đáp án vào đây... (Hệ thống tự động chấm điểm)"
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

      {/* ================= TAB 3: SỔ TỪ VỰNG ================= */}
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

          <h3 style={{ color: "#38bdf8" }}>📚 Danh sách từ vựng của bạn</h3>
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
