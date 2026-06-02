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

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Reset selection on filter changes
  useEffect(() => {
    setSelectedNodeId(null);
  }, [selectedYear, graphMode, selectedMatchType, selectedFormat]);

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

  const nodeStats = useMemo(() => {
    const stats: Record<string, { wins: number; losses: number; draws: number; total: number; winRate: number }> = {};
    
    // Initialize stats
    displayData.nodes.forEach(node => {
      stats[node.id] = { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0.5 };
    });

    displayData.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      if (!stats[sourceId]) stats[sourceId] = { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0.5 };
      if (!stats[targetId]) stats[targetId] = { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0.5 };

      if (link.type === 'DEFEATED') {
        stats[sourceId].wins += 1;
        stats[targetId].losses += 1;
        stats[sourceId].total += 1;
        stats[targetId].total += 1;
      } else if (link.type === 'BATTLED') {
        stats[sourceId].draws += 1;
        stats[targetId].draws += 1;
        stats[sourceId].total += 1;
        stats[targetId].total += 1;
      }
    });

    Object.values(stats).forEach(stat => {
      if (stat.total > 0) {
        stat.winRate = stat.wins / stat.total;
      }
    });

    return stats;
  }, [displayData]);

  const getWinRateColor = (rate: number) => {
    // Map 0 to 0 (Red), 0.5 to 60 (Yellow), 1.0 to 120 (Green)
    const hue = rate * 120;
    return `hsl(${Math.round(hue)}, 80%, 50%)`;
  };

  const { highlightNodes, highlightLinks } = useMemo(() => {
    const hNodes = new Set<string>();
    const hLinks = new Set<any>();

    if (selectedNodeId) {
      hNodes.add(selectedNodeId);

      displayData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        
        if (sourceId === selectedNodeId) {
          hLinks.add(link);
          hNodes.add(targetId);
        } else if (targetId === selectedNodeId) {
          hLinks.add(link);
          hNodes.add(sourceId);
        }
      });
    }

    return { highlightNodes: hNodes, highlightLinks: hLinks };
  }, [selectedNodeId, displayData]);

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
          fgRef.current.d3Force('charge').strength(-30);
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nodeVal={(node: any) => {
            let baseVal = node.val || 1;
            if (graphMode === 'Hierarchy') {
              // Exaggerate differences: make 1-battle nodes tiny, but heavily scale up veterans
              baseVal = Math.pow(baseVal, 1.8) * 0.02;
              // Ensure a minimum visibility size
              baseVal = Math.max(0.1, baseVal);
            }
            if (selectedNodeId) {
              if (node.id === selectedNodeId) return baseVal * 2.5;
              if (highlightNodes.has(node.id)) return baseVal * 1.8;
            }
            return baseVal;
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nodeColor={(node: any) => {
            if (selectedNodeId) {
              if (node.id === selectedNodeId) return '#FFFFFF';
              if (!highlightNodes.has(node.id)) return '#333333'; // Dimmed
            }
            if (node.group === 'Emcee') {
              const rate = nodeStats[node.id]?.winRate ?? 0.5;
              return getWinRateColor(rate);
            }
            if (node.group === 'Event') return '#ffb84d';
            return '#888888';
          }}
          nodeRelSize={4}
          nodeResolution={16}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkColor={(link: any) => {
            if (selectedNodeId) {
              if (highlightLinks.has(link)) return '#FFFFFF';
              return '#222222'; // Dimmed
            }
            if (link.type === 'ATTENDED') return '#ffb84d';
            if (link.match_type === 'tournament') return '#FFD700';
            if (link.type === 'DEFEATED') return '#ff4d4d';
            return '#888888';
          }}
          linkOpacity={0.6}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkWidth={(link: any) => {
            let baseWidth = 0.5;
            if (link.type === 'DEFEATED') {
              // Team battles get thicker links
              if (['2v2', '3v3', '5v5'].includes(link.match_format)) baseWidth = 2;
              else baseWidth = 1;
            }
            if (selectedNodeId) {
              if (highlightLinks.has(link)) return baseWidth * 4;
              return 0.1; // Very thin for dimmed links
            }
            return baseWidth;
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkDirectionalArrowLength={(link: any) => link.type === 'DEFEATED' ? 4 : link.type === 'ATTENDED' ? 3 : 0}
          linkDirectionalArrowRelPos={1}
          // Directional particles — visually encode match format
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkDirectionalParticles={(link: any) => {
            if (selectedNodeId) {
              if (highlightLinks.has(link)) return 4;
              return 0; // No particles on unhighlighted links
            }
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
            if (selectedNodeId && highlightLinks.has(link)) {
              return -0.01; // Negative speed reverses flow (In for win, Out for defeat)
            }
            if (link.match_type === 'tournament') return 0.008;
            if (link.match_format === 'royal_rumble') return 0.012;
            return 0.004;
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkDirectionalParticleWidth={(link: any) => {
            if (selectedNodeId && highlightLinks.has(link)) {
              return 5; // Extra large particles for highlighted links
            }
            if (link.match_type === 'tournament') return 3;
            if (['2v2', '3v3', '5v5'].includes(link.match_format)) return 2.5;
            if (link.match_format === 'royal_rumble') return 2;
            return 1.5;
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkDirectionalParticleColor={(link: any) => {
            if (selectedNodeId && highlightLinks.has(link)) {
              if (link.type === 'DEFEATED') {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                if (sourceId === selectedNodeId) return '#4ade80'; // Green (Win)
                return '#f87171'; // Red (Defeat)
              }
              return '#FFFFFF';
            }
            if (link.match_type === 'tournament') return '#FFD700';
            if (link.match_format === 'royal_rumble') return '#FF6B6B';
            if (link.type === 'ATTENDED') return '#ffb84d';
            return '#ff4d4d';
          }}
          backgroundColor="#0a0a0a"
          enableNodeDrag={true}
          onNodeDragEnd={(node: any) => {
            // Unpin the node after dragging so the physics simulation takes over again
            node.fx = undefined;
            node.fy = undefined;
            node.fz = undefined;
          }}
          onNodeClick={(node: any) => {
            setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
            if (fgRef.current) {
              // Increase distance for a wider field of view when focused
              const distance = 200;
              const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

              fgRef.current.cameraPosition(
                { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
                node, // lookAt ({ x, y, z })
                1500  // ms transition duration
              );
            }
          }}
          onBackgroundClick={() => setSelectedNodeId(null)}
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
