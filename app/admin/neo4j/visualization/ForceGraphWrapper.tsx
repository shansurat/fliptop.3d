'use client'

import { useRef, useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

interface GraphData {
  nodes: { id: string; name: string; val: number; group?: string }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  links: { source: string | any; target: string | any; type: string; year?: number | null; match_type?: string | null; match_format?: string | null }[];
}

const MATCH_TYPE_LABELS: Record<string, string> = {
  tournament: 'Tournament',
  non_tournament_judged: 'Non-Tournament',
  promo: 'Promo',
  tryout: 'Tryout',
};

const FORMAT_LABELS: Record<string, string> = {
  '1v1': '1v1',
  '2v2': '2v2',
  '3v3': '3v3',
  '5v5': '5v5',
  '3way': '3-Way',
  royal_rumble: 'Royal Rumble',
  handicap: 'Handicap',
};

export default function GraphClient({ graphData }: { graphData: GraphData }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [graphMode, setGraphMode] = useState<'Standard' | 'Hierarchy'>('Standard');
  const [selectedMatchType, setSelectedMatchType] = useState<string>('All');
  const [selectedFormat, setSelectedFormat] = useState<string>('All');
  const containerRef = useRef<HTMLDivElement>(null);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    graphData.links.forEach(link => {
      if (link.year != null) years.add(link.year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [graphData]);

  const availableMatchTypes = useMemo(() => {
    const types = new Set<string>();
    graphData.links.forEach(link => {
      if (link.match_type) types.add(link.match_type);
    });
    return Array.from(types).sort();
  }, [graphData]);

  const availableFormats = useMemo(() => {
    const formats = new Set<string>();
    graphData.links.forEach(link => {
      if (link.match_format) formats.add(link.match_format);
    });
    return Array.from(formats).sort();
  }, [graphData]);

  const displayData = useMemo(() => {
    let links = graphData.links;
    let nodes = graphData.nodes;

    if (graphMode === 'Hierarchy') {
      links = links.filter(link =>
        link.type === 'DEFEATED' &&
        link.match_format === '1v1' &&
        link.match_type !== 'tryout' &&
        link.match_type !== 'promo'
      );
      nodes = nodes.filter(node => node.group === 'Emcee');
    }

    if (selectedYear !== 'All') {
      const targetYear = parseInt(selectedYear);
      links = links.filter(link => link.year === targetYear);
    }

    if (selectedMatchType !== 'All') {
      links = links.filter(link => link.match_type === selectedMatchType || link.type === 'ATTENDED');
    }

    if (selectedFormat !== 'All') {
      links = links.filter(link => link.match_format === selectedFormat || link.type === 'ATTENDED');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const linkInvolves = (link: any, nodeId: string) =>
      (typeof link.source === 'object' ? link.source.id : link.source) === nodeId ||
      (typeof link.target === 'object' ? link.target.id : link.target) === nodeId;

    nodes = nodes.filter(node =>
      links.some(link => linkInvolves(link, node.id))
    );

    return { nodes, links };
  }, [graphData, selectedYear, graphMode, selectedMatchType, selectedFormat]);

  useEffect(() => {
    if (containerRef.current) {
      const updateDimensions = () => {
        setDimensions({
          width: containerRef.current?.clientWidth || 800,
          height: containerRef.current?.clientHeight || 600
        });
      };

      updateDimensions();
      window.addEventListener('resize', updateDimensions);

      // Auto-fit after data loads or filters
      setTimeout(() => {
        if (fgRef.current) {
          if (graphMode === 'Hierarchy') {
            // Apply strong repulsive force to prevent nodes from clumping vertically
            fgRef.current.d3Force('charge').strength(-200);
            fgRef.current.d3Force('link').distance(50);
          } else {
            fgRef.current.d3Force('charge').strength(-30);
          }
          // Re-heat simulation
          fgRef.current.d3ReheatSimulation();
          fgRef.current.zoomToFit(400);
        }
      }, 500);

      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, [displayData, graphMode]);

  return (
    <div ref={containerRef} className="w-full h-full relative group">
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
        <div className="bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 flex items-center justify-between gap-2">
          <label htmlFor="mode-select" className="text-sm text-[#A3A3A3]">Mode:</label>
          <select
            id="mode-select"
            value={graphMode}
            onChange={(e) => setGraphMode(e.target.value as 'Standard' | 'Hierarchy')}
            className="bg-[#2a2a2a] text-white border border-[#444] rounded px-2 py-1 text-sm outline-none focus:border-[#5E87C9] w-32"
          >
            <option value="Standard">Standard</option>
            <option value="Hierarchy">Hierarchy</option>
          </select>
        </div>

        <div className="bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 flex items-center justify-between gap-2">
          <label htmlFor="year-select" className="text-sm text-[#A3A3A3]">Year:</label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-[#2a2a2a] text-white border border-[#444] rounded px-2 py-1 text-sm outline-none focus:border-[#5E87C9] w-32"
          >
            <option value="All">All Years</option>
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 flex items-center justify-between gap-2">
          <label htmlFor="type-select" className="text-sm text-[#A3A3A3]">Type:</label>
          <select
            id="type-select"
            value={selectedMatchType}
            onChange={(e) => setSelectedMatchType(e.target.value)}
            className="bg-[#2a2a2a] text-white border border-[#444] rounded px-2 py-1 text-sm outline-none focus:border-[#5E87C9] w-32"
          >
            <option value="All">All Types</option>
            {availableMatchTypes.map(t => (
              <option key={t} value={t}>{MATCH_TYPE_LABELS[t] || t}</option>
            ))}
          </select>
        </div>

        <div className="bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 flex items-center justify-between gap-2">
          <label htmlFor="format-select" className="text-sm text-[#A3A3A3]">Format:</label>
          <select
            id="format-select"
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="bg-[#2a2a2a] text-white border border-[#444] rounded px-2 py-1 text-sm outline-none focus:border-[#5E87C9] w-32"
          >
            <option value="All">All Formats</option>
            {availableFormats.map(f => (
              <option key={f} value={f}>{FORMAT_LABELS[f] || f}</option>
            ))}
          </select>
        </div>
      </div>

      {displayData.nodes.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-[#707070]">
          {selectedYear === 'All' && selectedMatchType === 'All' && selectedFormat === 'All'
            ? 'No graph data found. Did you sync Emcees and Battles from Supabase?'
            : 'No battles found for the selected filters.'}
        </div>
      ) : (
        <ForceGraph3D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={displayData}
          nodeLabel="name"
          nodeVal="val"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nodeColor={(node: any) => {
            if (node.group === 'Emcee') return '#5E87C9';
            if (node.group === 'Event') return '#ffb84d';
            return '#888888';
          }}
          nodeRelSize={4}
          nodeResolution={16}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkColor={(link: any) => {
            if (link.type === 'ATTENDED') return '#ffb84d';
            if (link.match_type === 'tournament') return '#FFD700';
            if (link.type === 'DEFEATED') return '#ff4d4d';
            return '#888888';
          }}
          linkOpacity={0.6}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkWidth={(link: any) => {
            if (link.type === 'DEFEATED') {
              // Team battles get thicker links
              if (['2v2', '3v3', '5v5'].includes(link.match_format)) return 4;
              return 2;
            }
            return 1;
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkDirectionalArrowLength={(link: any) => link.type === 'DEFEATED' ? 4 : link.type === 'ATTENDED' ? 3 : 0}
          linkDirectionalArrowRelPos={1}
          // Directional particles — visually encode match format
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkDirectionalParticles={(link: any) => {
            if (link.type === 'ATTENDED') return 0;
            const fmt = link.match_format;
            if (fmt === 'royal_rumble') return 6;
            if (fmt === '5v5') return 5;
            if (fmt === '3v3' || fmt === '3way') return 3;
            if (fmt === '2v2') return 2;
            if (fmt === 'handicap') return 4;
            return 1; // 1v1 default
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkDirectionalParticleSpeed={(link: any) => {
            if (link.match_type === 'tournament') return 0.008;
            if (link.match_format === 'royal_rumble') return 0.012;
            return 0.004;
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkDirectionalParticleWidth={(link: any) => {
            if (link.match_type === 'tournament') return 3;
            if (['2v2', '3v3', '5v5'].includes(link.match_format)) return 2.5;
            if (link.match_format === 'royal_rumble') return 2;
            return 1.5;
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkDirectionalParticleColor={(link: any) => {
            if (link.match_type === 'tournament') return '#FFD700';
            if (link.match_format === 'royal_rumble') return '#FF6B6B';
            if (link.match_type === 'promo') return '#88E088';
            return '#ff4d4d';
          }}
          backgroundColor="#0a0a0a"
          enableNodeDrag={false}
          dagMode={graphMode === 'Hierarchy' ? 'td' : undefined}
          dagLevelDistance={graphMode === 'Hierarchy' ? 200 : undefined}
          onEngineStop={() => {
            if (graphMode === 'Hierarchy' && fgRef.current) {
              fgRef.current.zoomToFit(400);
            }
          }}
        />
      )}
    </div>
  );
}
