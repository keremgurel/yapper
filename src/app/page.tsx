"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import topics, {
  CATEGORIES,
  DIFFICULTIES,
  type Topic,
  type Category,
  type Difficulty,
} from "@/data/topics";
import { playSlotTick, playTimerEnd } from "@/lib/audio";
import SlotLever from "@/components/SlotLever";
import RotaryKnob from "@/components/RotaryKnob";
import TopicReel from "@/components/TopicReel";
import Recorder from "@/components/Recorder";

function getRandomTopic(
  exclude: Topic | null,
  category: Category | "All",
  difficulty: Difficulty | "All"
): Topic {
  let pool = topics;
  if (category !== "All") pool = pool.filter((t) => t.category === category);
  if (difficulty !== "All")
    pool = pool.filter((t) => t.difficulty === difficulty);
  if (pool.length === 0) pool = topics;
  let t: Topic;
  do {
    t = pool[Math.floor(Math.random() * pool.length)];
  } while (t === exclude && pool.length > 1);
  return t;
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-slate-500 uppercase tracking-[1.5px] font-semibold">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-card border border-border rounded-lg px-3 py-2 pr-8 text-[13px] text-foreground cursor-pointer outline-none min-w-[130px] bg-[length:12px_12px] bg-[position:right_10px_center] bg-no-repeat"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function Home() {
  const [topic, setTopic] = useState<Topic>(() =>
    getRandomTopic(null, "All", "All")
  );
  const [spinning, setSpinning] = useState(false);
  const [category, setCategory] = useState<Category | "All">("All");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync dark mode class with localStorage
  useEffect(() => {
    const stored = localStorage.getItem("yapper-dark");
    if (stored !== null) {
      setDarkMode(stored === "true");
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      setDarkMode(prefersDark);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("yapper-dark", String(darkMode));
  }, [darkMode]);

  const generateTopic = useCallback(() => {
    setSpinning(true);
    const tickInterval = setInterval(
      () => playSlotTick(600 + Math.random() * 400),
      80
    );
    setTimeout(() => {
      clearInterval(tickInterval);
      setSpinning(false);
      setTopic((prev) => getRandomTopic(prev, category, difficulty));
    }, 600);
  }, [category, difficulty]);

  const handleCategoryChange = (v: string) => {
    const cat = v as Category | "All";
    setCategory(cat);
    setTopic(getRandomTopic(topic, cat, difficulty));
  };

  const handleDifficultyChange = (v: string) => {
    const diff = v as Difficulty | "All";
    setDifficulty(diff);
    setTopic(getRandomTopic(topic, category, diff));
  };

  // Timer logic
  useEffect(() => {
    if (isRunning && !isPaused && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);
            setTimerDone(true);
            playTimerEnd();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, isPaused, timeLeft]);

  const startTimer = () => {
    setTimeLeft(timerSeconds);
    setIsRunning(true);
    setIsPaused(false);
    setTimerDone(false);
  };

  const pauseTimer = () => setIsPaused((p) => !p);

  const resetTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    setIsPaused(false);
    setTimerDone(false);
    setTimeLeft(timerSeconds);
  };

  const handleKnobChange = (val: number) => {
    setTimerSeconds(val);
    if (!isRunning) setTimeLeft(val);
  };

  const timerColor =
    timeLeft <= 10
      ? "text-red-500"
      : timeLeft <= 30
      ? "text-amber-500"
      : "text-foreground";

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center text-base font-black text-white">
            Y
          </div>
          <span className="text-[19px] font-extrabold text-foreground tracking-tight">
            yapper
          </span>
          <span className="text-[11px] text-slate-500 ml-1">ypr.app</span>
        </div>
        <button
          onClick={() => setDarkMode((d) => !d)}
          className="bg-transparent border border-border rounded-lg px-3 py-1.5 cursor-pointer text-[13px] text-slate-500 hover:bg-muted transition-colors"
        >
          {darkMode ? "Light" : "Dark"}
        </button>
      </header>

      {/* Filters */}
      <div className="flex justify-center gap-3 px-6 py-3.5 flex-wrap">
        <FilterDropdown
          label="Category"
          value={category}
          options={["All", ...CATEGORIES]}
          onChange={handleCategoryChange}
        />
        <FilterDropdown
          label="Difficulty"
          value={difficulty}
          options={["All", ...DIFFICULTIES]}
          onChange={handleDifficultyChange}
        />
      </div>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-5">
        <div className="grid grid-cols-[auto_minmax(280px,480px)_auto] items-center gap-10 max-md:grid-cols-1 max-md:gap-6 max-md:justify-items-center">
          {/* Lever */}
          <div className="flex flex-col items-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-[2px] font-semibold mb-2.5">
              GENERATE
            </div>
            <SlotLever onPull={generateTopic} />
          </div>

          {/* Center column */}
          <div className="flex flex-col items-center gap-5 w-full">
            <TopicReel topic={topic} spinning={spinning} />

            {/* Timer display */}
            <div className="flex flex-col items-center gap-3">
              <div
                className={`text-[44px] font-bold font-mono tracking-[4px] transition-colors duration-300 ${timerColor} ${
                  isRunning && timeLeft <= 10 ? "animate-pulse" : ""
                }`}
              >
                {formatTime(timeLeft)}
              </div>
              <div className="flex gap-2 items-center">
                {!isRunning && !timerDone && (
                  <button
                    onClick={startTimer}
                    className="px-6 py-2.5 rounded-[10px] bg-gradient-to-br from-blue-500 to-blue-600 text-white text-[13px] font-semibold cursor-pointer shadow-[0_2px_8px_rgba(37,99,235,0.3)] hover:opacity-90 transition-opacity"
                  >
                    Start
                  </button>
                )}
                {isRunning && (
                  <>
                    <button
                      onClick={pauseTimer}
                      className={`px-4 py-2.5 rounded-[10px] text-[13px] font-semibold cursor-pointer transition-opacity hover:opacity-80 ${
                        isPaused
                          ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {isPaused ? "Resume" : "Pause"}
                    </button>
                    <button
                      onClick={resetTimer}
                      className="px-4 py-2.5 rounded-[10px] bg-muted text-foreground text-[13px] font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      Reset
                    </button>
                  </>
                )}
                {timerDone && (
                  <button
                    onClick={() => {
                      resetTimer();
                      generateTopic();
                    }}
                    className="px-6 py-2.5 rounded-[10px] bg-gradient-to-br from-blue-500 to-blue-600 text-white text-[13px] font-semibold cursor-pointer shadow-[0_2px_8px_rgba(37,99,235,0.3)] hover:opacity-90 transition-opacity"
                  >
                    Try Another
                  </button>
                )}

                {/* Record button — sits inline with timer controls */}
                <Recorder />
              </div>
            </div>
          </div>

          {/* Knob */}
          <div className="flex flex-col items-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-[2px] font-semibold mb-2.5">
              TIMER
            </div>
            <RotaryKnob
              value={timerSeconds}
              onChange={handleKnobChange}
              min={30}
              max={120}
              disabled={isRunning}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-3.5 text-xs text-slate-500 border-t border-border">
        yapper · ypr.app
      </footer>
    </div>
  );
}
