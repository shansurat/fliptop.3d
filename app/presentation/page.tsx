'use client'

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

type Slide = {
  title: string;
  subtitle?: string;
  description?: string;
  bullets?: string[];
  imageUrl?: string;
};

const slides: Slide[] = [
  {
    title: 'fliptop.3d',
    subtitle: 'ROUND.01 // THE VISUAL CANVAS',
    description: 'An interactive WebGL 3D network graphing interface designed to explore, analyze, and manage the complex network of rap battles, emcees, and events in the Philippines.',
    imageUrl: '/assets/shehyee-smugglaz.jpg'
  },
  {
    title: 'The FlipTop Phenomenon',
    subtitle: 'ROUND.02 // THE RAP LEAGUE',
    bullets: [
      'Founding & Origins: Established in 2010 by Alaric Riam Yuson (Anygma), pioneering the modern a cappella rap battle format in the Philippines.',
      'Cultural Impact: Served as a massive cornerstone of modern Pinoy hip-hop culture, launching the careers of numerous underground emcees.',
      'Massive Viewership: Over 2.5 billion views on YouTube, with individual battles frequently crossing tens of millions of views.'
    ],
    imageUrl: '/assets/anygma.webp'
  },
  {
    title: 'Why a Graph Database?',
    subtitle: 'ROUND.03 // THE NETWORK MODEL',
    description: 'Traditional SQL relational tables struggle with dense, recursively queried network connections (e.g. tracking who defeated whom, draw networks, and mutual attendees).',
    bullets: [
      'First-Class Relationships: Matchups are represented naturally as edges (DEFEATED, BATTLED).',
      'Query Efficiency: Native graph traversal queries are significantly faster and simpler than complex SQL joins.'
    ],
    imageUrl: '/assets/neo4j-2.png'
  },
  {
    title: 'Analyzing through 3D Visualization',
    subtitle: 'ROUND.04 // BATTLE METRICS',
    description: 'By rendering nodes (Emcees, Events) and edges (Wins, Losses, Attendance) in a 3D simulation canvas:',
    bullets: [
      'Interactive Node Exploration: Click an Emcee to highlight their battle history, win/loss paths, and connected opponents.',
      '3D Camera Controls: Pan, zoom, and rotate the graph to inspect complex battle networks from different angles.',
      'Path Highlights: Instantly analyze matchup outcomes with green edges for wins and red edges for losses.'
    ],
    imageUrl: '/assets/neo4j-3.png'
  },
  {
    title: 'Architecture & Performance',
    subtitle: 'ROUND.05 // PERFORMANCE PIPELINE',
    bullets: [
      'Supabase: Relational database acting as the main source of truth.',
      'Neo4j: Graph database backend mapping nodes and edge relations.',
      'Next.js & R3F: Server action pipelines rendering a beautiful 3D Force-Graph canvas.',
      'Upstash Redis: Fast read-through cache layer reducing Neo4j database load for instant public page delivery.'
    ]
  }
];

function PresentationPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const slideParam = searchParams.get('slide');
  const activeIndex = slideParam !== null ? parseInt(slideParam, 10) : 0;
  const safeIndex = Math.max(0, Math.min(activeIndex, slides.length - 1));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePresentation();
      } else if (e.key === 'ArrowRight' || e.key === 'Space') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [safeIndex]);

  const closePresentation = () => {
    router.push('/');
  };

  const setSlide = (index: number) => {
    if (index >= 0 && index < slides.length) {
      router.replace(`/presentation?slide=${index}`);
    }
  };

  const nextSlide = () => {
    if (safeIndex < slides.length - 1) {
      setSlide(safeIndex + 1);
    }
  };

  const prevSlide = () => {
    if (safeIndex > 0) {
      setSlide(safeIndex - 1);
    }
  };

  const currentSlide = slides[safeIndex];

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col justify-between p-12 lg:p-20 text-zinc-300 font-mono">
      {/* Top Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-6 select-none">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-amber-500 bg-amber-950/20 border border-amber-500/20 px-3 py-1 rounded-sm tracking-widest uppercase">
            [ DECK // FLIPTOP.3D ]
          </span>
          <span className="text-zinc-600 text-sm">ROUND.{String(safeIndex + 1).padStart(2, '0')}</span>
        </div>
        <button
          onClick={closePresentation}
          className="text-sm text-zinc-500 hover:text-zinc-300 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 px-4 py-2 rounded-sm transition-all cursor-pointer font-bold"
        >
          CLOSE [ESC]
        </button>
      </div>

      {/* Slide Body */}
      <div className="flex-1 my-12 flex items-center justify-center">
        <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-12 gap-12 items-center bg-[#0c0c0c] border border-white/5 p-12 lg:p-16 rounded-none relative shadow-2xl">

          {/* Corner Crosshair Decorations to look like stencils/blueprints */}
          <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 text-zinc-700 font-mono text-lg select-none pointer-events-none">+</div>
          <div className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 text-zinc-700 font-mono text-lg select-none pointer-events-none">+</div>
          <div className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 text-zinc-700 font-mono text-lg select-none pointer-events-none">+</div>
          <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 text-zinc-700 font-mono text-lg select-none pointer-events-none">+</div>

          {/* Text Content */}
          <div className={`${currentSlide.imageUrl ? 'md:col-span-7' : 'md:col-span-12'} flex flex-col justify-center space-y-6`}>
            {currentSlide.subtitle && (
              <span className="text-sm md:text-base text-amber-500/80 tracking-widest uppercase font-semibold">
                {currentSlide.subtitle}
              </span>
            )}
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#EFEFEF] tracking-tight uppercase leading-tight font-sans">
              {currentSlide.title}
            </h2>

            {currentSlide.description && (
              <p className="text-lg md:text-2xl text-zinc-400 leading-relaxed max-w-4xl font-light font-sans">
                {currentSlide.description}
              </p>
            )}

            {currentSlide.bullets && (
              <ul className="space-y-5 pt-4">
                {currentSlide.bullets.map((bullet, i) => {
                  const colonIndex = bullet.indexOf(':');
                  if (colonIndex !== -1) {
                    const prefix = bullet.substring(0, colonIndex);
                    const rest = bullet.substring(colonIndex);
                    return (
                      <li key={i} className="text-lg md:text-2xl text-zinc-400 leading-relaxed flex items-start font-sans">
                        <span className="text-amber-500/80 mr-3 font-mono select-none">[-]</span>
                        <span>
                          <strong className="text-[#EFEFEF] font-mono tracking-wide uppercase text-xl md:text-2xl block md:inline md:mr-2">{prefix}</strong>
                          {rest}
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={i} className="text-lg md:text-2xl text-zinc-400 leading-relaxed flex items-start font-sans">
                      <span className="text-amber-500/80 mr-3 font-mono select-none">[-]</span>
                      <span>{bullet}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Image Content */}
          {currentSlide.imageUrl && (
            <div className="md:col-span-5 relative flex items-center justify-center overflow-hidden rounded-none bg-black/40 border border-white/5 min-h-[400px] md:min-h-[500px] select-none">
              <Image
                src={currentSlide.imageUrl}
                alt={currentSlide.title}
                fill
                className="object-cover aspect-video md:aspect-square filter grayscale brightness-90 hover:grayscale-0 transition-all duration-300"
              />
            </div>
          )}

        </div>
      </div>

      {/* Bottom Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center border-t border-white/5 pt-8 gap-6 select-none">

        {/* Progress rounds / indices */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-600">
            DECK STATUS:
          </span>
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                className={`px-4 py-1 border text-sm cursor-pointer transition-all ${i === safeIndex
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold'
                  : 'bg-transparent border-white/5 text-zinc-600 hover:text-zinc-300 hover:border-white/10'
                  }`}
                aria-label={`Go to slide ${i + 1}`}
              >
                R.{i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Previous / Next buttons */}
        <div className="flex items-center gap-4">
          <button
            onClick={prevSlide}
            disabled={safeIndex === 0}
            className="px-6 py-2 text-sm text-zinc-500 hover:text-zinc-300 bg-white/[0.01] border border-white/5 rounded-none disabled:opacity-20 disabled:hover:text-zinc-500 disabled:cursor-not-allowed transition-all cursor-pointer font-bold"
          >
            PREV
          </button>
          <span className="text-sm text-zinc-700 select-none hidden md:inline">&lt; ARROWS &gt;</span>
          <button
            onClick={nextSlide}
            disabled={safeIndex === slides.length - 1}
            className="px-6 py-2 text-sm text-zinc-500 hover:text-zinc-300 bg-white/[0.01] border border-white/5 rounded-none disabled:opacity-20 disabled:hover:text-zinc-500 disabled:cursor-not-allowed transition-all cursor-pointer font-bold"
          >
            NEXT
          </button>
        </div>

      </div>
    </div>
  );
}

export default function PresentationPage() {
  return (
    <Suspense fallback={null}>
      <PresentationPageInner />
    </Suspense>
  );
}
