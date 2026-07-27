import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HelpCircle, BarChart2, RotateCcw, Settings, X, Check, ArrowRight, Play, HelpCircle as HelpIcon, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SECRET_WORDS, VALID_GUESSES } from './words';

// Define the LetterStatus type
export type LetterStatus = 'CORRECT' | 'PRESENT' | 'ABSENT' | 'EMPTY';


// Stats default layout
interface StatsData {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  guesses: number[]; // size 6 array
}

const DEFAULT_STATS: StatsData = {
  played: 0,
  won: 0,
  streak: 0,
  maxStreak: 0,
  guesses: [0, 0, 0, 0, 0, 0]
};

// Custom toast notification structure
interface ToastMessage {
  id: string;
  text: string;
  type: 'info' | 'error' | 'success';
}

export default function App() {
  // Core game states
  const [secretWord, setSecretWord] = useState<string>('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState<string>('');
  const [gameStatus, setGameStatus] = useState<'PLAYING' | 'WON' | 'LOST'>('PLAYING');
  const [revealedRows, setRevealedRows] = useState<boolean[]>(Array(6).fill(false));
  
  // UI Interaction states
  const [shakeRowIndex, setShakeRowIndex] = useState<number | null>(null);
  const [invalidGuess, setInvalidGuess] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [activeModal, setActiveModal] = useState<'HELP' | 'STATS' | 'SETTINGS' | null>(null);
  
  // User settings preferences
  const [strictMode, setStrictMode] = useState<boolean>(true);
  const [hardMode, setHardMode] = useState<boolean>(false); // requires green letters in correct spot, and yellow letters utilized

  // User Stats
  const [stats, setStats] = useState<StatsData>(DEFAULT_STATS);

  // Initialize stats on mount
  useEffect(() => {
    const savedStats = localStorage.getItem('wordle_unlimited_stats');
    if (savedStats) {
      try {
        setStats(JSON.parse(savedStats));
      } catch (e) {
        console.error("Failed to parse saved statistics:", e);
      }
    }
    // Select first word
    startNewRound();
  }, []);

  // Set local storage whenever stats change
  const saveStats = (newStats: StatsData) => {
    setStats(newStats);
    localStorage.setItem('wordle_unlimited_stats', JSON.stringify(newStats));
  };

  // Display a custom toast
  const showToast = useCallback((text: string, type: 'info' | 'error' | 'success' = 'info', duration = 2000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToast({ id, text, type });
    
    setTimeout(() => {
      setToast(prev => prev?.id === id ? null : prev);
    }, duration);
  }, []);

  // Reset or Start New Wordle game
  const startNewRound = () => {
    if (SECRET_WORDS.length === 0) return;
    const randomIndex = Math.floor(Math.random() * SECRET_WORDS.length);
    const chosenWord = SECRET_WORDS[randomIndex];
    
    setSecretWord(chosenWord);
    setGuesses([]);
    setCurrentGuess('');
    setGameStatus('PLAYING');
    setRevealedRows(Array(6).fill(false));
    setShakeRowIndex(null);
    setInvalidGuess(false);
    console.log("New Word Selected (for debugging/development):", chosenWord);
  };

  // Helper algorithm to calculate letter coloring status with duplicate letter protection
  const getLetterStatuses = useCallback((guess: string): LetterStatus[] => {
    const statuses = Array(5).fill('ABSENT') as LetterStatus[];
    const secretLetterCount: { [key: string]: number } = {};
    
    // Count letter frequencies in secret word
    for (const char of secretWord) {
      secretLetterCount[char] = (secretLetterCount[char] || 0) + 1;
    }
    
    // First pass: mark correct positions (green)
    for (let i = 0; i < 5; i++) {
      if (guess[i] === secretWord[i]) {
        statuses[i] = 'CORRECT';
        secretLetterCount[guess[i]]--;
      }
    }
    
    // Second pass: mark present positions (yellow)
    for (let i = 0; i < 5; i++) {
      if (statuses[i] !== 'CORRECT') {
        const char = guess[i];
        if (secretLetterCount[char] && secretLetterCount[char] > 0) {
          statuses[i] = 'PRESENT';
          secretLetterCount[char]--;
        }
      }
    }
    
    return statuses;
  }, [secretWord]);

  // Aggregate current keyboard letter mapping colors
  const getKeyboardLetterStatuses = useCallback(() => {
    const keyboardStatuses: { [key: string]: LetterStatus } = {};

    guesses.forEach((guess) => {
      const statuses = getLetterStatuses(guess);
      for (let i = 0; i < 5; i++) {
        const char = guess[i];
        const status = statuses[i];
        const currentBest = keyboardStatuses[char];
        
        if (!currentBest) {
          keyboardStatuses[char] = status;
        } else if (currentBest === 'PRESENT' && status === 'CORRECT') {
          keyboardStatuses[char] = 'CORRECT';
        } else if (currentBest === 'ABSENT' && (status === 'PRESENT' || status === 'CORRECT')) {
          keyboardStatuses[char] = status;
        }
      }
    });

    return keyboardStatuses;
  }, [guesses, getLetterStatuses]);

  const triggerRowShake = (index: number) => {
    setShakeRowIndex(index);
    setTimeout(() => {
      setShakeRowIndex(null);
    }, 450);
  };

  // Handles submitting a guess
  const submitGuess = useCallback(() => {
    if (gameStatus !== 'PLAYING') return;

    if (currentGuess.length < 5) {
      showToast('Not enough letters', 'error');
      triggerRowShake(guesses.length);
      return;
    }

    const uppercaseGuess = currentGuess.toUpperCase();

    // 1. Hard Mode Check
    if (hardMode && guesses.length > 0) {
      const lastGuess = guesses[guesses.length - 1];
      const lastStatuses = getLetterStatuses(lastGuess);
      
      // Check correct (green) placements
      for (let i = 0; i < 5; i++) {
        if (lastStatuses[i] === 'CORRECT' && uppercaseGuess[i] !== lastGuess[i]) {
          showToast(`${i + 1}st letter must be ${lastGuess[i]}`, 'error');
          triggerRowShake(guesses.length);
          return;
        }
      }
      
      // Check present (yellow) letter reuse
      for (let i = 0; i < 5; i++) {
        if (lastStatuses[i] === 'PRESENT') {
          const char = lastGuess[i];
          if (!uppercaseGuess.includes(char)) {
            showToast(`Guess must contain ${char}`, 'error');
            triggerRowShake(guesses.length);
            return;
          }
        }
      }
    }

    // 2. Strict Dictionary Validation
    if (strictMode && !VALID_GUESSES.includes(uppercaseGuess)) {
      showToast('Not in word list', 'error');
      triggerRowShake(guesses.length);
      return;
    }

    // Add guess to state
    const nextGuesses = [...guesses, uppercaseGuess];
    setGuesses(nextGuesses);
    setCurrentGuess('');

    // Trigger sequential reveal flip for the row
    const nextRevealedRows = [...revealedRows];
    nextRevealedRows[guesses.length] = true;
    setRevealedRows(nextRevealedRows);

    // Calculate game result
    if (uppercaseGuess === secretWord) {
      // User won!
      setGameStatus('WON');
      
      // Update Stats
      const attemptIndex = guesses.length; // 0-indexed guess count
      const updatedGuesses = [...stats.guesses];
      updatedGuesses[attemptIndex] = (updatedGuesses[attemptIndex] || 0) + 1;
      
      const newStreak = stats.streak + 1;
      const newMaxStreak = Math.max(newStreak, stats.maxStreak);
      
      const updatedStats: StatsData = {
        played: stats.played + 1,
        won: stats.won + 1,
        streak: newStreak,
        maxStreak: newMaxStreak,
        guesses: updatedGuesses
      };
      
      setTimeout(() => {
        saveStats(updatedStats);
        // Display positive cheer
        const praises = ['Genius!', 'Magnificent!', 'Splendid!', 'Superb!', 'Well done!', 'Excellent!'];
        const randomPraise = praises[Math.min(attemptIndex, praises.length - 1)];
        showToast(randomPraise, 'success', 3000);
        
        // Auto-open stats modal after beautiful dramatic pause
        setTimeout(() => {
          setActiveModal('STATS');
        }, 1500);
      }, 600 * 5); // wait for tiles to flip

    } else if (nextGuesses.length >= 6) {
      // User lost!
      setGameStatus('LOST');
      
      const updatedStats: StatsData = {
        ...stats,
        played: stats.played + 1,
        streak: 0
      };
      
      setTimeout(() => {
        saveStats(updatedStats);
        showToast(`The word was ${secretWord}`, 'info', 4000);
        
        // Auto-open stats modal after delay
        setTimeout(() => {
          setActiveModal('STATS');
        }, 2200);
      }, 600 * 5); // wait for tiles to flip
    }

  }, [currentGuess, guesses, secretWord, gameStatus, strictMode, hardMode, stats, revealedRows, getLetterStatuses, showToast]);

  // Handles character/button additions
  const handleKeyPress = useCallback((key: string) => {
    if (gameStatus !== 'PLAYING') return;

    if (key === 'ENTER') {
      submitGuess();
    } else if (key === 'BACKSPACE' || key === 'BACK') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (/^[a-zA-Z]$/.test(key)) {
      if (currentGuess.length < 5) {
        setCurrentGuess(prev => (prev + key).toUpperCase());
      }
    }
  }, [currentGuess, gameStatus, submitGuess]);

  // Handle hardware keyboard interactions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent mapping keys if modals or inputs are active
      if (activeModal !== null) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Enter') {
        handleKeyPress('ENTER');
      } else if (e.key === 'Backspace') {
        handleKeyPress('BACKSPACE');
      } else {
        handleKeyPress(e.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress, activeModal]);

  // Clear Stats button handler
  const clearStatistics = () => {
    saveStats(DEFAULT_STATS);
    showToast('Statistics reset successfully!', 'success');
  };

  const keyboardColors = getKeyboardLetterStatuses();

  return (
    <div className="min-h-screen bg-[#020617] text-[#f8fafc] font-sans flex flex-col justify-between overflow-x-hidden antialiased">
      
      {/* 1. Header component */}
      <header className="border-b border-[#1e293b] py-3.5 px-4 flex items-center justify-between sticky top-0 bg-[#020617]/95 backdrop-blur-md z-30">
        <div className="flex items-center gap-2">
          <button 
            id="btn-rules"
            onClick={() => setActiveModal('HELP')}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-lg transition-all duration-200"
            title="How to Play"
          >
            <HelpCircle size={22} />
          </button>
          
          <button 
            id="btn-settings"
            onClick={() => setActiveModal('SETTINGS')}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-lg transition-all duration-200"
            title="Settings"
          >
            <Settings size={22} />
          </button>
        </div>

        {/* Brand Logo Title */}
        <div className="text-center flex flex-col items-center select-none">
          <h1 className="text-lg md:text-2xl font-light font-display tracking-[0.12em] text-[#e2e8f0]">
            ARIOCOLE'S WORDLE
          </h1>
          <span className="text-[10px] uppercase tracking-widest text-[#94a3b8] font-bold mt-0.5 bg-[#1e293b] px-2 py-0.5 rounded border border-[#334155]">
            Unlimited
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button 
            id="btn-stats"
            onClick={() => setActiveModal('STATS')}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-lg transition-all duration-200"
            title="Statistics"
          >
            <BarChart2 size={22} />
          </button>

          <button 
            id="btn-restart"
            onClick={() => {
              startNewRound();
              showToast('New word selected!', 'success');
            }}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-lg transition-all duration-200 hover:rotate-45"
            title="Reset Game"
          >
            <RotateCcw size={21} />
          </button>
        </div>
      </header>

      {/* Toast Alert Banner */}
      <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-max max-w-[90vw]">
        <AnimatePresence mode="wait">
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={`px-4 py-2.5 rounded-lg text-sm font-bold shadow-2xl flex items-center gap-2 border ${
                toast.type === 'error' 
                  ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                  : toast.type === 'success' 
                  ? 'bg-green-500/15 text-green-400 border-green-500/25' 
                  : 'bg-slate-900 text-white border-slate-700/50'
              }`}
            >
              {toast.type === 'success' && <Sparkles size={16} className="text-yellow-300 animate-pulse" />}
              <span>{toast.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Playable Stage Grid Area */}
      <main className="flex-1 flex flex-col justify-center items-center py-4 px-2 select-none">
        
        {/* Gameboard Grid Rows */}
        <div className="grid grid-rows-6 gap-1.5 max-w-[350px] w-full aspect-[5/6] justify-center items-center">
          {Array(6).fill(null).map((_, rowIndex) => {
            const isGuessedRow = rowIndex < guesses.length;
            const rowGuess = isGuessedRow ? guesses[rowIndex] : (rowIndex === guesses.length ? currentGuess : '');
            const isCurrentRow = rowIndex === guesses.length;
            const isShaking = shakeRowIndex === rowIndex;
            const letterStatuses = isGuessedRow ? getLetterStatuses(rowGuess) : [];

            return (
              <div 
                key={rowIndex} 
                className={`grid grid-cols-5 gap-1.5 w-full ${isShaking ? 'animate-shake' : ''}`}
              >
                {Array(5).fill(null).map((_, charIndex) => {
                  const letter = rowGuess[charIndex] || '';
                  const status = isGuessedRow ? letterStatuses[charIndex] : 'EMPTY';
                  
                  // Interactive styles
                  let bgClass = 'bg-[#020617] border-[#334155] text-[#f8fafc]';
                  let borderClass = 'border-2';
                  let flipDelay = charIndex * 150; // Delay for sequential tile flipping
                  
                  if (isGuessedRow) {
                     if (status === 'CORRECT') {
                      bgClass = 'bg-[#059669] border-[#059669] text-white';
                    } else if (status === 'PRESENT') {
                      bgClass = 'bg-[#d97706] border-[#d97706] text-white';
                    } else {
                      bgClass = 'bg-[#334155] border-[#334155] text-[#f8fafc]';
                    }
                    borderClass = 'border-0';
                  } else if (letter) {
                    // Filled cell (typing active)
                    borderClass = 'border-2 border-[#64748b]';
                  }

                  return (
                    <div
                      key={charIndex}
                      id={`tile-r${rowIndex}-c${charIndex}`}
                      style={isGuessedRow ? { animationDelay: `${flipDelay}ms` } : undefined}
                      className={`
                        w-12 h-12 md:w-14 md:h-14 flex items-center justify-center 
                        text-xl md:text-2xl font-extrabold uppercase rounded-sm select-none transition-all duration-150
                        ${borderClass} ${bgClass}
                        ${letter && !isGuessedRow ? 'animate-bounce-custom' : ''}
                        ${isGuessedRow ? 'animate-flip' : ''}
                      `}
                    >
                      <span className="backface-hidden">{letter}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Game End Control Panel (Quick Replay) */}
        {gameStatus !== 'PLAYING' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="mt-5 bg-[#1e293b] border border-[#475569] p-5 rounded-xl flex flex-col items-center text-center max-w-xs w-full shadow-2xl animate-fade-in"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              {gameStatus === 'WON' ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <p className="text-emerald-400 font-bold tracking-widest text-lg uppercase font-display">SUPERB</p>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <p className="text-slate-300 font-bold tracking-widest uppercase font-display">GAME OVER</p>
                </>
              )}
            </div>

            {gameStatus === 'LOST' && (
              <p className="text-slate-400 text-xs mb-3.5">
                The word was <strong className="text-white text-sm tracking-widest font-mono">{secretWord}</strong>
              </p>
            )}

            <div className="flex gap-2.5 w-full mt-1">
              <button
                id="btn-show-stats"
                onClick={() => setActiveModal('STATS')}
                className="flex-1 py-2.5 px-3 bg-[#334155] hover:bg-[#475569] text-slate-100 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-200"
              >
                <BarChart2 size={14} />
                Statistics
              </button>
              
              <button
                id="btn-play-again-main"
                onClick={startNewRound}
                className="flex-1 py-2.5 px-3 bg-[#f8fafc] hover:bg-[#e2e8f0] text-[#020617] font-black text-xs rounded-lg flex items-center justify-center gap-1.5 uppercase tracking-wide transition-all duration-200 transform active:scale-95 shadow-lg"
              >
                <Play size={13} fill="currentColor" />
                Play Again
              </button>
            </div>
          </motion.div>
        )}
      </main>

      {/* 2. Keyboard Component */}
      <footer className="w-full max-w-[500px] mx-auto px-1.5 pb-4 select-none">
        <div className="flex flex-col gap-1.5">
          {[
            ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
            ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
            ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK']
          ].map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center gap-1 w-full">
              {row.map((key) => {
                const colorStatus = keyboardColors[key];
                
                // Keyboard Key Styles
                let keyColorClass = 'bg-[#1e293b] text-slate-100 hover:bg-[#334155] active:bg-[#475569]';
                if (colorStatus === 'CORRECT') {
                  keyColorClass = 'bg-[#059669] text-white';
                } else if (colorStatus === 'PRESENT') {
                  keyColorClass = 'bg-[#d97706] text-white';
                } else if (colorStatus === 'ABSENT') {
                  keyColorClass = 'bg-[#334155] text-slate-500';
                }

                const isSpecial = key === 'ENTER' || key === 'BACK';
                const keyWidthClass = isSpecial ? 'flex-[1.5]' : 'flex-1';

                return (
                  <button
                    key={key}
                    id={`key-${key.toLowerCase()}`}
                    onClick={() => handleKeyPress(key)}
                    className={`
                      ${keyWidthClass} h-14 md:h-15 text-xs md:text-sm font-black rounded-lg
                      flex items-center justify-center select-none cursor-pointer transition-all duration-100
                      ${keyColorClass}
                    `}
                  >
                    {key === 'BACK' ? (
                      <span className="text-zinc-200">⌫</span>
                    ) : (
                      key
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </footer>

      {/* Modals Container */}
      <AnimatePresence>
        {/* Help Modal */}
        {activeModal === 'HELP' && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              id="help-modal"
              className="bg-[#1e293b] border border-[#475569] w-full max-w-md p-6 rounded-2xl shadow-2xl relative overflow-y-auto max-h-[90vh]"
            >
              <button 
                id="btn-close-help"
                onClick={() => setActiveModal(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-[#334155] p-1.5 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>

              <h2 className="text-xl font-bold font-display tracking-wide mb-4 flex items-center gap-1.5 text-[#e2e8f0]">
                <HelpIcon size={20} className="text-[#059669]" /> How To Play
              </h2>
              
              <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                Guess the Wordle in 6 tries. Each guess must be a valid 5-letter word.
              </p>
              
              <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                The color of the tiles will change to show how close your guess was to the word.
              </p>

              <hr className="border-[#334155] my-4" />

              <h3 className="text-sm font-bold text-[#e2e8f0] uppercase tracking-wider mb-3 font-display">Examples</h3>

              <div className="flex flex-col gap-4 mb-4 text-xs md:text-sm">
                <div>
                  <div className="flex gap-1.5 mb-1.5">
                    <div className="w-8 h-8 bg-[#059669] font-bold text-white flex items-center justify-center rounded-sm">W</div>
                    <div className="w-8 h-8 bg-[#334155] font-bold text-white flex items-center justify-center rounded-sm">E</div>
                    <div className="w-8 h-8 bg-[#334155] font-bold text-white flex items-center justify-center rounded-sm">A</div>
                    <div className="w-8 h-8 bg-[#334155] font-bold text-white flex items-center justify-center rounded-sm">R</div>
                    <div className="w-8 h-8 bg-[#334155] font-bold text-white flex items-center justify-center rounded-sm">Y</div>
                  </div>
                  <p className="text-slate-400">
                    The letter <strong className="text-white">W</strong> is in the word and in the correct spot.
                  </p>
                </div>

                <div>
                  <div className="flex gap-1.5 mb-1.5">
                    <div className="w-8 h-8 bg-[#334155] font-bold text-white flex items-center justify-center rounded-sm">P</div>
                    <div className="w-8 h-8 bg-[#d97706] font-bold text-white flex items-center justify-center rounded-sm">I</div>
                    <div className="w-8 h-8 bg-[#334155] font-bold text-white flex items-center justify-center rounded-sm">L</div>
                    <div className="w-8 h-8 bg-[#334155] font-bold text-white flex items-center justify-center rounded-sm">O</div>
                    <div className="w-8 h-8 bg-[#334155] font-bold text-white flex items-center justify-center rounded-sm">T</div>
                  </div>
                  <p className="text-slate-400">
                    The letter <strong className="text-white">I</strong> is in the word but in the wrong spot.
                  </p>
                </div>

                <div>
                  <div className="flex gap-1.5 mb-1.5">
                    <div className="w-8 h-8 bg-[#334155] font-bold text-white flex items-center justify-center rounded-sm">V</div>
                    <div className="w-8 h-8 bg-[#334155] font-bold text-white flex items-center justify-center rounded-sm">A</div>
                    <div className="w-8 h-8 bg-[#334155] font-bold text-white flex items-center justify-center rounded-sm">G</div>
                    <div className="w-8 h-8 bg-[#334155] font-bold text-white flex items-center justify-center rounded-sm">U</div>
                    <div className="w-8 h-8 bg-[#334155] font-bold text-white flex items-center justify-center rounded-sm">E</div>
                  </div>
                  <p className="text-slate-400">
                    The letters are not in the word in any spot.
                  </p>
                </div>
              </div>

              <hr className="border-[#334155] my-4" />

              <div className="bg-[#020617]/50 p-3.5 rounded-xl border border-[#334155]/60">
                <p className="text-slate-400 text-xs leading-relaxed">
                  🔄 <strong className="text-white">Unlimited Mode Enabled:</strong> Replay instantly as much as you like! Press the reset icon or play again to pick a brand new word anytime.
                </p>
              </div>

              <button
                id="btn-help-close-bottom"
                onClick={() => setActiveModal(null)}
                className="w-full mt-5 py-2.5 bg-[#f8fafc] hover:bg-[#e2e8f0] text-[#020617] font-extrabold uppercase tracking-wide rounded-xl transition-all duration-200 transform active:scale-98 shadow-lg"
              >
                Let's Play!
              </button>
            </motion.div>
          </div>
        )}

        {/* Stats Modal */}
        {activeModal === 'STATS' && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              id="stats-modal"
              className="bg-[#1e293b] border border-[#475569] w-full max-w-md p-6 rounded-2xl shadow-2xl relative overflow-y-auto max-h-[90vh]"
            >
              <button 
                id="btn-close-stats"
                onClick={() => setActiveModal(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-[#334155] p-1.5 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>

              <h2 className="text-xl font-light font-display tracking-[0.15em] mb-4 text-[#e2e8f0] uppercase text-center">
                Statistics
              </h2>

              {/* Grid Metrics */}
              <div className="grid grid-cols-4 gap-2 text-center mb-6">
                <div className="bg-[#020617]/40 p-2.5 rounded-lg border border-[#334155]">
                  <p className="text-2xl md:text-3xl font-light font-display text-white">{stats.played}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Played</p>
                </div>
                <div className="bg-[#020617]/40 p-2.5 rounded-lg border border-[#334155]">
                  <p className="text-2xl md:text-3xl font-light font-display text-white">
                    {stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0}%
                  </p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Win %</p>
                </div>
                <div className="bg-[#020617]/40 p-2.5 rounded-lg border border-[#334155]">
                  <p className="text-2xl md:text-3xl font-semibold font-display text-emerald-400">{stats.streak}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Streak</p>
                </div>
                <div className="bg-[#020617]/40 p-2.5 rounded-lg border border-[#334155]">
                  <p className="text-2xl md:text-3xl font-semibold font-display text-amber-500">{stats.maxStreak}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Max Streak</p>
                </div>
              </div>

              {/* Chart Guess Distribution */}
              <h3 className="text-xs font-bold text-[#e2e8f0] uppercase tracking-wider mb-4 border-b border-[#334155] pb-2 font-display">
                Guess Distribution
              </h3>

              <div className="flex flex-col gap-2 mb-6">
                {stats.guesses.map((count, index) => {
                  const maxCount = Math.max(...stats.guesses, 1);
                  const widthPercent = Math.max(8, (count / maxCount) * 100);
                  const isCurrentGuessCount = gameStatus === 'WON' && guesses.length === index + 1;

                  return (
                    <div key={index} className="flex items-center text-xs">
                      <span className="w-4 font-mono font-bold text-slate-400 text-right pr-2">{index + 1}</span>
                      <div className="flex-1">
                        <div 
                          style={{ width: `${widthPercent}%` }}
                          className={`
                            py-1 px-2.5 rounded-sm font-black text-right pr-2 text-white font-mono flex justify-end
                            ${isCurrentGuessCount ? 'bg-[#059669]' : 'bg-[#334155]'}
                          `}
                        >
                          {count}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reset/Control triggers */}
              <div className="flex flex-col gap-2.5 pt-2 border-t border-[#334155]">
                <button
                  id="btn-play-again-modal"
                  onClick={() => {
                    startNewRound();
                    setActiveModal(null);
                    showToast('Game reset! New word picked.', 'success');
                  }}
                  className="w-full py-3 bg-[#f8fafc] hover:bg-[#e2e8f0] text-[#020617] font-extrabold uppercase tracking-wide rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all duration-200 transform active:scale-98"
                >
                  <Play size={15} fill="currentColor" />
                  Play New Round
                </button>
                
                <button
                  id="btn-close-stats-modal"
                  onClick={() => setActiveModal(null)}
                  className="w-full py-2.5 bg-[#334155] hover:bg-[#475569] text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all duration-200"
                >
                  Close Summary
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Settings Modal */}
        {activeModal === 'SETTINGS' && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              id="settings-modal"
              className="bg-[#1e293b] border border-[#475569] w-full max-w-md p-6 rounded-2xl shadow-2xl relative"
            >
              <button 
                id="btn-close-settings"
                onClick={() => setActiveModal(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-[#334155] p-1.5 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>

              <h2 className="text-xl font-light font-display tracking-[0.15em] mb-5 text-[#e2e8f0] uppercase">
                Settings
              </h2>

              {/* Options list */}
              <div className="flex flex-col gap-4 mb-6">
                
                {/* Option 1: Strict word list check */}
                <div className="flex items-center justify-between pb-3.5 border-b border-[#334155]">
                  <div>
                    <h3 className="text-sm font-bold text-white">Strict Dictionary Mode</h3>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed max-w-[240px]">
                      Validate guessed words against our dictionary. Disable to allow guessing any five letters.
                    </p>
                  </div>
                  <button
                    id="toggle-strict-mode"
                    onClick={() => setStrictMode(!strictMode)}
                    className={`w-11 h-6 rounded-full transition-colors relative duration-200 outline-none ${
                      strictMode ? 'bg-[#059669]' : 'bg-[#334155]'
                    }`}
                  >
                    <span 
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-200 ${
                        strictMode ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Option 2: Hard Mode */}
                <div className="flex items-center justify-between pb-3.5 border-b border-[#334155]">
                  <div>
                    <h3 className="text-sm font-bold text-white">Hard Mode</h3>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed max-w-[240px]">
                      Any revealed hints must be used in subsequent guesses.
                    </p>
                  </div>
                  <button
                    id="toggle-hard-mode"
                    onClick={() => setHardMode(!hardMode)}
                    className={`w-11 h-6 rounded-full transition-colors relative duration-200 outline-none ${
                      hardMode ? 'bg-[#059669]' : 'bg-[#334155]'
                    }`}
                  >
                    <span 
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-200 ${
                        hardMode ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Clear statistics data */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <h3 className="text-sm font-bold text-red-400">Reset All Statistics</h3>
                    <p className="text-xs text-slate-400 mt-0.5 max-w-[240px]">
                      Permanently wipe out streak counter, played matches, and score graphs.
                    </p>
                  </div>
                  <button
                    id="btn-clear-stats"
                    onClick={() => {
                      if (confirm("Are you sure you want to reset all game statistics? This cannot be undone.")) {
                        clearStatistics();
                      }
                    }}
                    className="px-3 py-1.5 bg-red-950/20 border border-red-900/40 text-red-400 hover:bg-red-900/30 text-xs font-black rounded-lg transition-colors"
                  >
                    Reset
                  </button>
                </div>

              </div>

              <button
                id="btn-settings-done"
                onClick={() => setActiveModal(null)}
                className="w-full py-2.5 bg-[#f8fafc] hover:bg-[#e2e8f0] text-[#020617] font-extrabold uppercase tracking-wide rounded-xl transition-all duration-200 shadow-lg"
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
