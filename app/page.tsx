'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

type Choice = 'rock' | 'paper' | 'scissors';
const CHOICES: Choice[] = ['rock', 'paper', 'scissors'];
const CHOICES_EMOJIS: Record<Choice, string> = {
  rock: '🪨',
  paper: '📄',
  scissors: '✂️'
};

export default function GamePage() {
  const [userScore, setUserScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'animating' | 'capturing' | 'resolving' | 'result'>('idle');
  const [lightColor, setLightColor] = useState<'red' | 'yellow' | 'green' | 'none'>('none');
  const [showPlayModal, setShowPlayModal] = useState(false);
  const [winner, setWinner] = useState<'user' | 'opponent' | 'draw' | null>(null);

  const [userEmojiIndex, setUserEmojiIndex] = useState(0);
  const [opponentEmojiIndex, setOpponentEmojiIndex] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const targetUserChoiceRef = useRef<Choice | null>(null);
  const targetOpponentChoiceRef = useRef<Choice | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const modelRef = useRef<any>(null);

  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startVideo = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
      }
    };
    startVideo();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      clearAllTimeouts();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const classifyGesture = async (): Promise<Choice> => {
    try {
      if (!(window as any).tmImage) {
        console.error("tmImage not loaded");
        return 'rock';
      }
      
      const URL = process.env.NEXT_PUBLIC_TM_MODEL_URL || "https://teachablemachine.withgoogle.com/models/yQu5oVOCf/";
      const modelURL = URL + "model.json";
      const metadataURL = URL + "metadata.json";

      if (!modelRef.current) {
        modelRef.current = await (window as any).tmImage.load(modelURL, metadataURL);
      }
      
      if (videoRef.current && modelRef.current) {
        const prediction = await modelRef.current.predict(videoRef.current);
        let highestProb = -1;
        let bestClass = 'rock';
        for (let i = 0; i < prediction.length; i++) {
          if (prediction[i].probability > highestProb) {
            highestProb = prediction[i].probability;
            bestClass = prediction[i].className.toLowerCase();
          }
        }
        
        if (bestClass.includes('rock')) return 'rock';
        if (bestClass.includes('paper')) return 'paper';
        if (bestClass.includes('scissor')) return 'scissors';
      }
      return 'rock';
    } catch (e) {
      console.error("TM API error:", e);
      return 'rock';
    }
  };

  const captureAndClassify = async () => {
    if (videoRef.current) {
      const oppChoice = CHOICES[Math.floor(Math.random() * 3)];
      targetOpponentChoiceRef.current = oppChoice;

      const userChoice = await classifyGesture();
      targetUserChoiceRef.current = userChoice as Choice;
      setGameState('resolving');
    }
  };

  const startRound = () => {
    clearAllTimeouts();
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    setGameState('animating');
    setLightColor('red');
    setShowPlayModal(false);
    setWinner(null);
    targetUserChoiceRef.current = null;
    targetOpponentChoiceRef.current = null;

    intervalRef.current = setInterval(() => {
      setUserEmojiIndex(prev => {
        if (targetUserChoiceRef.current && CHOICES[prev] === targetUserChoiceRef.current) return prev;
        return (prev + 1) % 3;
      });
      setOpponentEmojiIndex(prev => {
        if (targetOpponentChoiceRef.current && CHOICES[prev] === targetOpponentChoiceRef.current) return prev;
        return (prev + 1) % 3;
      });
    }, 200);

    const t1 = setTimeout(() => {
      setLightColor('yellow');
      setShowPlayModal(true);
    }, 4000);

    const t2 = setTimeout(() => {
      setLightColor('green');
      setShowPlayModal(false);
      setGameState('capturing');
      captureAndClassify();
    }, 6000);

    timeoutsRef.current = [t1, t2];
  };

  const determineWinner = (user: Choice, opp: Choice) => {
    if (user === opp) {
      setWinner('draw');
    } else if (
      (user === 'rock' && opp === 'scissors') ||
      (user === 'paper' && opp === 'rock') ||
      (user === 'scissors' && opp === 'paper')
    ) {
      setWinner('user');
      setUserScore(s => s + 1);
    } else {
      setWinner('opponent');
      setOpponentScore(s => s + 1);
    }
  };

  useEffect(() => {
    if (gameState === 'resolving' || gameState === 'capturing') {
      const userSettled = targetUserChoiceRef.current && CHOICES[userEmojiIndex] === targetUserChoiceRef.current;
      const oppSettled = targetOpponentChoiceRef.current && CHOICES[opponentEmojiIndex] === targetOpponentChoiceRef.current;

      if (userSettled && oppSettled) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setTimeout(() => {
          setGameState('result');
          determineWinner(targetUserChoiceRef.current!, targetOpponentChoiceRef.current!);
        }, 0);
      }
    }
  }, [userEmojiIndex, opponentEmojiIndex, gameState]);

  return (
    <div className="flex h-screen w-full bg-slate-900 text-white font-sans overflow-hidden">
      {/* Left Side: User */}
      <div className="flex-1 flex flex-col items-center justify-center relative border-r-2 border-slate-700 bg-slate-800/50">
        <div className="absolute top-8 left-8 text-3xl font-bold text-slate-300">
          You: <span className="text-blue-400">{userScore}</span>
        </div>
        
        <div className="relative w-72 h-72 rounded-full overflow-hidden border-8 border-slate-700 shadow-2xl mb-12 bg-slate-900">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover transform -scale-x-100" 
          />
          {gameState === 'capturing' && (
            <div className="absolute inset-0 border-4 border-green-500 rounded-full animate-pulse" />
          )}
        </div>
        
        <div className="h-40 flex items-center justify-center">
          <div className="text-[10rem] drop-shadow-2xl select-none">
            {CHOICES_EMOJIS[CHOICES[userEmojiIndex]]}
          </div>
        </div>
      </div>

      {/* Right Side: Opponent */}
      <div className="flex-1 flex flex-col items-center justify-center relative bg-slate-800/30">
        <div className="absolute top-8 right-8 text-3xl font-bold text-slate-300">
          Opponent: <span className="text-red-400">{opponentScore}</span>
        </div>
        
        <div className="w-72 h-72 rounded-full bg-slate-800 border-8 border-slate-700 shadow-2xl mb-12 flex items-center justify-center">
          <span className="text-8xl">🤖</span>
        </div>
        
        <div className="h-40 flex items-center justify-center">
          <div className="text-[10rem] drop-shadow-2xl select-none">
            {CHOICES_EMOJIS[CHOICES[opponentEmojiIndex]]}
          </div>
        </div>
      </div>

      {/* Center Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
        {/* Traffic Light */}
        <div className="bg-slate-900 p-4 rounded-full flex flex-col gap-4 border-4 border-slate-700 shadow-2xl absolute top-12">
          <div className={`w-8 h-8 rounded-full transition-all duration-300 ${lightColor === 'red' ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,1)] scale-110' : 'bg-red-950/50'}`} />
          <div className={`w-8 h-8 rounded-full transition-all duration-300 ${lightColor === 'yellow' ? 'bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,1)] scale-110' : 'bg-yellow-950/50'}`} />
          <div className={`w-8 h-8 rounded-full transition-all duration-300 ${lightColor === 'green' ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,1)] scale-110' : 'bg-green-950/50'}`} />
        </div>

        {/* Play Modal */}
        <AnimatePresence>
          {showPlayModal && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 0.95, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -20 }}
              className="absolute bg-white px-12 py-6 rounded-3xl shadow-[0_0_50px_rgba(250,204,21,0.5)] border-8 border-yellow-400 z-50"
              style={{ fontFamily: '"Comic Sans MS", "Comic Sans", cursive' }}
            >
              <h1 className="text-7xl font-black tracking-widest text-yellow-500">PLAY</h1>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result & Actions */}
        <div className="absolute bottom-24 flex flex-col items-center gap-8 pointer-events-auto">
          <AnimatePresence>
            {gameState === 'result' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="text-4xl font-black tracking-wider px-8 py-4 rounded-2xl bg-slate-800 border-2 border-slate-600 shadow-xl uppercase">
                  {winner === 'user' ? (
                    <span className="text-green-400">You Win! 🎉</span>
                  ) : winner === 'opponent' ? (
                    <span className="text-red-400">Opponent Wins! 🤖</span>
                  ) : (
                    <span className="text-yellow-400">It&apos;s a Draw! 🤝</span>
                  )}
                </div>
                <button
                  onClick={startRound}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-10 py-5 rounded-3xl text-3xl font-bold shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all hover:scale-105 active:scale-95 border-4 border-blue-400"
                  style={{ fontFamily: '"Comic Sans MS", "Comic Sans", cursive' }}
                >
                  NEXT ROUND
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {gameState === 'idle' && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={startRound}
              className="bg-blue-500 hover:bg-blue-600 text-white px-10 py-5 rounded-3xl text-3xl font-bold shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all hover:scale-105 active:scale-95 border-4 border-blue-400"
              style={{ fontFamily: '"Comic Sans MS", "Comic Sans", cursive' }}
            >
              START GAME
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
