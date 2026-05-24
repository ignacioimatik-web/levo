'use client';

import { useEffect, useState } from 'react';

export default function MtbRiderBackground() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Sky gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950"></div>

      {/* Far background trees */}
      <div
        className="absolute inset-x-0 bottom-0 h-full opacity-20"
        style={{ transform: `translateY(${scrollY * 0.1}px)` }}
      >
        <svg viewBox="0 0 1440 900" className="w-full h-full" preserveAspectRatio="xMidYMax slice">
          {[...Array(20)].map((_, i) => {
            const x = (i / 20) * 1440 + Math.sin(i * 2.5) * 60;
            const h = 150 + Math.sin(i * 1.3) * 80 + Math.cos(i * 0.7) * 40;
            const w = 40 + Math.sin(i * 1.8) * 15;
            const opacity = 0.15 + Math.sin(i * 0.9) * 0.1;
            return (
              <g key={`tree-far-${i}`} opacity={Math.max(0.05, opacity)}>
                <rect x={x - w / 6} y={900 - h} width={w / 3} height={h} fill="#1e293b" rx={2} />
                <ellipse cx={x} cy={900 - h - 20} rx={w / 2 + 10} ry={35 + Math.sin(i * 1.1) * 10} fill="#0f172a" />
                <ellipse cx={x - 15} cy={900 - h + 5} rx={w / 3} ry={25} fill="#1e293b" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Mid background trees */}
      <div
        className="absolute inset-x-0 bottom-0 h-full opacity-40"
        style={{ transform: `translateY(${scrollY * 0.2}px)` }}
      >
        <svg viewBox="0 0 1440 900" className="w-full h-full" preserveAspectRatio="xMidYMax slice">
          {[...Array(14)].map((_, i) => {
            const x = (i / 14) * 1440 + Math.cos(i * 1.7) * 80;
            const h = 200 + Math.sin(i * 2.1) * 100 + Math.cos(i * 0.5) * 50;
            const w = 50 + Math.sin(i * 1.4) * 20;
            return (
              <g key={`tree-mid-${i}`}>
                <rect x={x - w / 6} y={900 - h} width={w / 3} height={h} fill="#1e293b" rx={2} />
                <ellipse cx={x} cy={900 - h - 25} rx={w / 2 + 15} ry={40 + Math.sin(i * 0.8) * 15} fill="#0f172a" />
                <ellipse cx={x + 12} cy={900 - h + 10} rx={w / 3} ry={30} fill="#1e293b" />
                <ellipse cx={x - 18} cy={900 - h - 5} rx={w / 3 - 5} ry={25} fill="#0f172a" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Foreground terrain */}
      <div className="absolute inset-x-0 bottom-0 h-1/3">
        <svg viewBox="0 0 1440 400" className="w-full h-full" preserveAspectRatio="xMidYMax slice">
          <defs>
            <linearGradient id="terrainGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" stopOpacity="0" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <path
            d="M0,250 Q60,220 120,240 T240,220 T360,260 T480,210 T600,250 T720,200 T840,240 T960,210 T1080,260 T1200,220 T1320,240 T1440,210 L1440,400 L0,400 Z"
            fill="url(#terrainGrad)"
          />
          <path
            d="M0,300 Q80,270 160,290 T320,270 T480,310 T640,260 T800,290 T960,270 T1120,310 T1280,280 T1440,300 L1440,400 L0,400 Z"
            fill="#0f172a"
            opacity="0.4"
          />
        </svg>
      </div>

      {/* Track / trail line on terrain */}
      <div
        className="absolute inset-x-0 bottom-[15%] h-1 opacity-20"
        style={{ transform: `translateY(${scrollY * 0.05}px)` }}
      >
        <svg viewBox="0 0 1440 10" className="w-full h-full" preserveAspectRatio="none">
          <path
            d="M0,5 Q60,2 120,6 T240,3 T360,7 T480,2 T600,6 T720,3 T840,7 T960,2 T1080,6 T1200,3 T1320,7 T1440,2"
            stroke="#78716c"
            strokeWidth="1"
            fill="none"
            opacity="0.5"
          />
        </svg>
      </div>

      {/* Animated MTB Rider */}
      <div
        className="absolute bottom-[18%] left-1/2 -translate-x-1/2"
        style={{
          transform: `translateX(-50%) translateY(${scrollY * 0.3}px)`,
        }}
      >
        <div className="rider-jump relative">
          <svg
            width="120"
            height="100"
            viewBox="0 0 120 100"
            fill="none"
            className="rider-bike"
          >
            {/* Rear wheel */}
            <circle cx="30" cy="75" r="16" stroke="#f97316" strokeWidth="2.5" fill="none" />
            <circle cx="30" cy="75" r="3" fill="#f97316" />
            {/* Rear spokes */}
            {[0, 45, 90, 135].map((angle) => (
              <line
                key={`spoke-r-${angle}`}
                x1={30 + 13 * Math.cos((angle * Math.PI) / 180)}
                y1={75 + 13 * Math.sin((angle * Math.PI) / 180)}
                x2={30 - 13 * Math.cos((angle * Math.PI) / 180)}
                y2={75 - 13 * Math.sin((angle * Math.PI) / 180)}
                stroke="#f97316"
                strokeWidth="0.8"
                opacity="0.6"
              />
            ))}
            {/* Front wheel */}
            <circle cx="86" cy="68" r="16" stroke="#f97316" strokeWidth="2.5" fill="none" />
            <circle cx="86" cy="68" r="3" fill="#f97316" />
            {/* Front spokes */}
            {[0, 45, 90, 135].map((angle) => (
              <line
                key={`spoke-f-${angle}`}
                x1={86 + 13 * Math.cos((angle * Math.PI) / 180)}
                y1={68 + 13 * Math.sin((angle * Math.PI) / 180)}
                x2={86 - 13 * Math.cos((angle * Math.PI) / 180)}
                y2={68 - 13 * Math.sin((angle * Math.PI) / 180)}
                stroke="#f97316"
                strokeWidth="0.8"
                opacity="0.6"
              />
            ))}
            {/* Frame */}
            <line x1="30" y1="75" x2="58" y2="55" stroke="#f97316" strokeWidth="2.5" />
            <line x1="58" y1="55" x2="86" y2="68" stroke="#f97316" strokeWidth="2.5" />
            <line x1="30" y1="75" x2="65" y2="72" stroke="#f97316" strokeWidth="2" />
            <line x1="65" y1="72" x2="58" y2="55" stroke="#f97316" strokeWidth="2" />
            <line x1="65" y1="72" x2="78" y2="58" stroke="#f97316" strokeWidth="2" />
            {/* Seat */}
            <line x1="54" y1="50" x2="62" y2="50" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
            {/* Seat post */}
            <line x1="58" y1="55" x2="58" y2="50" stroke="#f97316" strokeWidth="2" />
            {/* Handlebar */}
            <line x1="82" y1="60" x2="90" y2="58" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
            {/* Fork */}
            <line x1="86" y1="68" x2="82" y2="60" stroke="#f97316" strokeWidth="2" />
            {/* Rider body */}
            <line x1="58" y1="50" x2="62" y2="35" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
            {/* Rider torso */}
            <line x1="62" y1="35" x2="78" y2="30" stroke="#f97316" strokeWidth="3.5" strokeLinecap="round" />
            {/* Rider head */}
            <circle cx="82" cy="25" r="7" stroke="#f97316" strokeWidth="2.5" fill="none" />
            {/* Helmet */}
            <path d="M75,24 Q82,16 89,24" stroke="#f97316" strokeWidth="2.5" fill="none" />
            {/* Rider arms */}
            <line x1="72" y1="32" x2="84" y2="55" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
            {/* Rider legs */}
            <line x1="58" y1="50" x2="50" y2="62" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="50" y1="62" x2="45" y2="72" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
            {/* Pedal */}
            <line x1="42" y1="72" x2="48" y2="70" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
          </svg>

          {/* Motion lines */}
          <div className="absolute top-1/2 -right-8 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={`line-${i}`}
                className="h-0.5 bg-orange-500/30 rounded-full motion-line"
                style={{
                  width: `${12 + i * 8}px`,
                  animationDelay: `${i * 0.3}s`,
                }}
              />
            ))}
          </div>

          {/* Dirt particles */}
          <div className="absolute bottom-0 right-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={`particle-${i}`}
                className="absolute w-1 h-1 bg-orange-500/40 rounded-full dirt-particle"
                style={{
                  left: `${i * 6}px`,
                  top: `${-i * 4}px`,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .rider-jump {
          animation: jump 2.8s ease-in-out infinite;
        }

        .rider-bike {
          animation: tilt 2.8s ease-in-out infinite;
        }

        .motion-line {
          animation: fadeLine 1.4s ease-in-out infinite;
        }

        .dirt-particle {
          animation: dirt 1.4s ease-out infinite;
        }

        @keyframes jump {
          0%, 100% {
            transform: translateY(0);
          }
          45% {
            transform: translateY(-60px);
          }
          60% {
            transform: translateY(-55px);
          }
        }

        @keyframes tilt {
          0%, 100% {
            transform: rotate(0deg);
          }
          40% {
            transform: rotate(-8deg);
          }
          55% {
            transform: rotate(-5deg);
          }
          70% {
            transform: rotate(2deg);
          }
        }

        @keyframes fadeLine {
          0% {
            opacity: 0;
            transform: translateX(0);
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateX(-20px);
          }
        }

        @keyframes dirt {
          0% {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-15px, -20px) scale(0);
          }
        }
      `}</style>
    </div>
  );
}
