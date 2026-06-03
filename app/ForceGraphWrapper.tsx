'use client'

import { useRef, useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

interface GraphData {
  nodes: { id: string; name: string; val: number; group?: string; hometown?: string | null; total_views?: number | null; avatar_url?: string | null }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  links: { source: string | any; target: string | any; type: string; year?: number | null; match_type?: string | null; match_format?: string | null; battle_name?: string | null; view_count?: number | null; event_name?: string | null }[];
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

export default function GraphClient({ graphData, mode }: { graphData: GraphData, mode: 'Standard' | 'Hierarchy' }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [selectedMatchType, setSelectedMatchType] = useState<string>('All');
  const [selectedFormat, setSelectedFormat] = useState<string>('All');
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedLink, setSelectedLink] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'winRate' | 'views' | 'wins' | 'losses'>('name');
  const [sizeBasis, setSizeBasis] = useState<'battles' | 'views'>('battles');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return graphData.nodes.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId, graphData]);

  // Reset selection on filter changes
  useEffect(() => {
    setSelectedNodeId(null);
    setSelectedLink(null);
  }, [selectedYear, mode, selectedMatchType, selectedFormat]);

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
      if (link.match_type) {
        if (mode === 'Hierarchy' && !['tournament', 'non_tournament_judged'].includes(link.match_type)) {
          return;
        }
        types.add(link.match_type);
      }
    });
    return Array.from(types).sort();
  }, [graphData, mode]);

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

    if (mode === 'Hierarchy') {
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
  }, [graphData, selectedYear, mode, selectedMatchType, selectedFormat]);

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

  const filteredEmceesList = useMemo(() => {
    let emcees = displayData.nodes.filter(n => n.group === 'Emcee');

    emcees = [...emcees].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'winRate') {
        const rateA = nodeStats[a.id]?.winRate ?? 0;
        const rateB = nodeStats[b.id]?.winRate ?? 0;
        return rateB - rateA;
      }
      if (sortBy === 'views') {
        const viewsA = a.total_views ?? 0;
        const viewsB = b.total_views ?? 0;
        return viewsB - viewsA;
      }
      if (sortBy === 'wins') {
        const winsA = nodeStats[a.id]?.wins ?? 0;
        const winsB = nodeStats[b.id]?.wins ?? 0;
        return winsB - winsA;
      }
      if (sortBy === 'losses') {
        const lossesA = nodeStats[a.id]?.losses ?? 0;
        const lossesB = nodeStats[b.id]?.losses ?? 0;
        return lossesB - lossesA;
      }
      return 0;
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      emcees = emcees.filter(n => n.name.toLowerCase().includes(q));
    }
    return emcees;
  }, [displayData.nodes, searchQuery, sortBy, nodeStats]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSearchSelect = (node: any) => {
    setSearchQuery('');
    if (selectedNodeId === node.id) {
      setSelectedNodeId(null);
    } else {
      setSelectedNodeId(node.id);
      if (fgRef.current && node.x !== undefined && node.y !== undefined && node.z !== undefined) {
        const distance = 200;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        fgRef.current.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
          node,
          1500
        );
      } else {
        // Fallback if simulation hasn't populated coordinates yet
        setTimeout(() => {
          if (fgRef.current) {
            const updatedNode = displayData.nodes.find(n => n.id === node.id);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const un = updatedNode as any;
            if (un && un.x !== undefined) {
              const distance = 200;
              const distRatio = 1 + distance / Math.hypot(un.x, un.y, un.z);
              fgRef.current.cameraPosition(
                { x: un.x * distRatio, y: un.y * distRatio, z: un.z * distRatio },
                un,
                1500
              );
            }
          }
        }, 500);
      }
    }
  };

  const getWinRateColor = (rate: number) => {
    // Map 0 to 0 (Red), 0.5 to 60 (Yellow), 1.0 to 120 (Green)
    const hue = rate * 120;
    return `hsl(${Math.round(hue)}, 80%, 50%)`;
  };

  const { highlightNodes, highlightLinks } = useMemo(() => {
    const hNodes = new Set<string>();
    const hLinks = new Set<any>();

    if (selectedLink) {
      hLinks.add(selectedLink);
      const sourceId = typeof selectedLink.source === 'object' ? selectedLink.source.id : selectedLink.source;
      const targetId = typeof selectedLink.target === 'object' ? selectedLink.target.id : selectedLink.target;
      hNodes.add(sourceId);
      hNodes.add(targetId);
    } else if (selectedNodeId) {
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
  }, [selectedNodeId, selectedLink, displayData]);

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
  }, [displayData, mode]);

  return (
    <div ref={containerRef} className="w-full h-full relative group font-sans">
      {/* Mobile Menu FAB */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden absolute bottom-6 left-6 z-[60] w-12 h-12 rounded-full bg-[#121212]/90 backdrop-blur-md border border-white/10 flex items-center justify-center text-white shadow-lg pointer-events-auto transition-transform hover:scale-105 active:scale-95"
      >
        {isMobileMenuOpen ? (
          <span className="text-xl">✕</span>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
        )}
      </button>

      <div className={`absolute z-[55] flex flex-col gap-2 transition-all duration-300 w-64 pointer-events-auto md:top-4 md:right-4 md:bottom-auto md:left-auto md:opacity-80 group-hover:md:opacity-100 md:translate-y-0 ${isMobileMenuOpen ? 'max-md:bottom-20 max-md:left-6 max-md:opacity-100 max-md:translate-y-0 max-md:max-h-[60vh] max-md:overflow-y-auto custom-scrollbar' : 'max-md:bottom-20 max-md:left-6 max-md:opacity-0 max-md:pointer-events-none max-md:translate-y-4'}`}>

        <div className='flex gap-2'>
          <select
            id="year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-[#121212]/30 backdrop-blur-md text-[#A3A3A3] hover:text-[#EFEFEF] border border-white/5 rounded-md px-3 py-2 text-xs outline-none focus:border-white/20 transition-all w-32 cursor-pointer"
          >
            <option value="All">All Years</option>
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            id="type-select"
            value={selectedMatchType}
            onChange={(e) => setSelectedMatchType(e.target.value)}
            className="bg-[#121212]/30 backdrop-blur-md text-[#A3A3A3] hover:text-[#EFEFEF] border border-white/5 rounded-md px-3 py-2 text-xs outline-none focus:border-white/20 transition-all w-32 cursor-pointer"
          >
            <option value="All">All Types</option>
            {availableMatchTypes.map(t => (
              <option key={t} value={t}>{MATCH_TYPE_LABELS[t] || t}</option>
            ))}
          </select>
        </div>
        {/* Search Bar */}
        <div className="relative w-full">
          <input
            type="text"
            placeholder="Search Emcee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#121212]/30 backdrop-blur-md text-[#A3A3A3] focus:text-[#EFEFEF] border border-white/5 rounded-md px-3 py-2 text-xs outline-none focus:border-white/20 focus:bg-white/[0.04] placeholder-[#555] transition-all"
          />
        </div>



        {/* Scrollable Emcees List */}
        <div className="bg-[#121212]/20 backdrop-blur-md border border-white/5 rounded-md flex flex-col overflow-hidden max-h-[300px]">
          <div className="px-3 py-1.5 border-b border-white/5 flex justify-between items-center bg-transparent shrink-0">
            <span className="text-xs text-[#A3A3A3] uppercase tracking-wider font-semibold">Emcees ({filteredEmceesList.length})</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-[#A3A3A3] border border-white/5 rounded-md px-2 py-0.5 text-[10px] outline-none focus:border-white/20 w-24 hover:text-[#EFEFEF] transition-colors cursor-pointer"
            >
              <option value="name">Sort: Name</option>
              <option value="winRate">Sort: Win Rate</option>
              <option value="views">Sort: Views</option>
              <option value="wins">Sort: Wins</option>
              <option value="losses">Sort: Losses</option>
            </select>
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-white/[0.03] scrollbar-thin">
            {filteredEmceesList.length === 0 ? (
              <div className="p-3 text-xs text-[#555] text-center">No emcees found</div>
            ) : (
              filteredEmceesList.map(emcee => {
                const isSelected = selectedNodeId === emcee.id;
                const rate = nodeStats[emcee.id]?.winRate ?? 0.5;
                const wins = nodeStats[emcee.id]?.wins ?? 0;
                const losses = nodeStats[emcee.id]?.losses ?? 0;
                const views = emcee.total_views ?? 0;
                const hasAvatar = !!emcee.avatar_url;

                let metricLabel = '';
                let metricStyle = {};

                if (sortBy === 'winRate' || sortBy === 'name') {
                  metricLabel = `${(rate * 100).toFixed(0)}% WR`;
                  metricStyle = { color: getWinRateColor(rate) };
                } else if (sortBy === 'views') {
                  metricLabel = views >= 1000000
                    ? `${(views / 1000000).toFixed(1)}M v`
                    : views >= 1000
                      ? `${(views / 1000).toFixed(0)}K v`
                      : `${views} v`;
                  metricStyle = { color: '#A3A3A3' };
                } else if (sortBy === 'wins') {
                  metricLabel = `${wins} W`;
                  metricStyle = { color: '#4ade80' };
                } else if (sortBy === 'losses') {
                  metricLabel = `${losses} L`;
                  metricStyle = { color: '#f87171' };
                }

                return (
                  <button
                    key={emcee.id}
                    onClick={() => handleSearchSelect(emcee)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${isSelected ? 'bg-white/[0.07] text-[#EFEFEF]' : 'text-[#A3A3A3] hover:bg-white/[0.03] hover:text-[#EFEFEF]'
                      }`}
                  >
                    {hasAvatar ? (
                      <Image
                        src={emcee.avatar_url!}
                        alt={emcee.name}
                        width={20}
                        height={20}
                        className="w-5 h-5 rounded-full object-cover shrink-0 border border-white/5 shadow-sm"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-white/[0.05] border border-white/5 flex items-center justify-center text-[9px] text-[#A3A3A3] font-bold shrink-0 font-mono">
                        {emcee.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="truncate flex-1 font-medium">{emcee.name}</span>
                    <span className="font-mono text-[10px] shrink-0" style={metricStyle}>
                      {metricLabel}
                    </span>
                  </button>
                );
              })
            )}
          </div>
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
            let baseVal = 1.5;
            if (node.group === 'Emcee') {
              if (sizeBasis === 'battles') {
                const totalBattles = nodeStats[node.id]?.total || 0;
                baseVal = 2 + (totalBattles * 0.4);
              } else {
                const views = node.total_views || 0;
                baseVal = 1.5 + (Math.sqrt(views) * 0.004);
              }
            } else if (node.group === 'Event') {
              baseVal = 8;
            }

            if (mode === 'Hierarchy') {
              // Exaggerate differences: make 1-battle nodes tiny, but heavily scale up veterans
              baseVal = Math.pow(baseVal, 1.8) * 0.02;
              // Ensure a minimum visibility size
              baseVal = Math.max(0.1, baseVal);
            }
            if (selectedNodeId || selectedLink) {
              if (node.id === selectedNodeId) return baseVal * 2.5;
              if (highlightNodes.has(node.id)) return baseVal * 1.8;
            }
            return baseVal;
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nodeColor={(node: any) => {
            if (selectedNodeId || selectedLink) {
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
            if (selectedNodeId || selectedLink) {
              if (highlightLinks.has(link)) {
                if (link.type === 'DEFEATED') {
                  const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                  const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                  if (selectedNodeId) {
                    if (sourceId === selectedNodeId) return '#4ade80'; // Win
                    if (targetId === selectedNodeId) return '#f87171'; // Loss
                  } else if (selectedLink) {
                    return '#4ade80'; // Highlight victory direction
                  }
                }
                return '#FFFFFF';
              }
              return '#1a1a1a'; // Dimmed
            }
            if (link.type === 'ATTENDED') return '#b45309'; // Darker gold/orange
            if (link.match_type === 'tournament') return '#b59210'; // Darker metallic gold
            if (link.match_type === 'promo') return '#be185d'; // Darker magenta
            if (link.match_type === 'tryout') return '#0369a1'; // Darker blue
            if (link.type === 'DEFEATED') return '#4a5568'; // Slate grey
            return '#555555';
          }}
          linkOpacity={0.6}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkWidth={(link: any) => {
            let baseWidth = .6; // Slightly thicker default link width
            if (link.type === 'DEFEATED' || link.type === 'BATTLED') {
              if (['2v2', '3v3', '5v5'].includes(link.match_format)) baseWidth = 1.4;
            } else if (link.type === 'ATTENDED') {
              baseWidth = 0.3;
            }

            if (selectedNodeId || selectedLink) {
              if (highlightLinks.has(link)) return baseWidth * 1.2;
              return 0.05; // Very thin for dimmed links
            }
            return baseWidth;
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkDirectionalArrowLength={(link: any) => link.type === 'DEFEATED' ? 4 : link.type === 'ATTENDED' ? 3 : 0}
          linkDirectionalArrowRelPos={1}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkDirectionalParticles={(link: any) => {
            if ((selectedNodeId || selectedLink) && highlightLinks.has(link)) {
              return 4;
            }
            return 0;
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkDirectionalParticleSpeed={(link: any) => {
            if ((selectedNodeId || selectedLink) && highlightLinks.has(link)) {
              return -0.003; // Negative speed reverses flow (In for win, Out for defeat)
            }
            if (link.match_type === 'tournament') return 0.008;
            if (link.match_format === 'royal_rumble') return 0.012;
            return 0.004;
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkDirectionalParticleWidth={(link: any) => {
            if ((selectedNodeId || selectedLink) && highlightLinks.has(link)) {
              return 1.8; // Subtle particles for highlighted links
            }
            if (link.match_type === 'tournament') return 1.8;
            if (['2v2', '3v3', '5v5'].includes(link.match_format)) return 1.5;
            if (link.match_format === 'royal_rumble') return 1.2;
            return 1.0;
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkDirectionalParticleColor={(link: any) => {
            if ((selectedNodeId || selectedLink) && highlightLinks.has(link)) {
              if (link.type === 'DEFEATED') {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                if (selectedNodeId && sourceId === selectedNodeId) return '#4ade80'; // Green (Win)
                if (selectedNodeId) return '#f87171'; // Red (Defeat)
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
            setSelectedLink(null);
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
          onLinkClick={(link: any) => {
            if (link.type === 'ATTENDED') return;
            setSelectedNodeId(null);
            setSelectedLink(selectedLink === link ? null : link);
          }}
          onBackgroundClick={() => { setSelectedNodeId(null); setSelectedLink(null); }}
          onEngineStop={() => {
            if (mode === 'Hierarchy' && fgRef.current && !selectedNodeId) {
              fgRef.current.zoomToFit(400);
            }
          }}
        />
      )}

      {/* Node Details Panel */}
      {/* {selectedNode && selectedNode.group === 'Emcee' && (
        // <div className="absolute left-6 top-24 z-20 w-80 bg-[#191919]/95 backdrop-blur-md border border-[#2F2F2F] rounded-md shadow-lg p-5 transition-all duration-300">

        <div className='flex flex-col absolute left-6 top-24 w-40'>
          {selectedNode.avatar_url ? (
            <img
              src={selectedNode.avatar_url}
              alt={selectedNode.name}
              className="w-full aspect-2/3 rounded-md object-cover border border-[#2F2F2F]"
            />
          ) : (
            <div className="w-10 h-10 rounded-md border border-[#2F2F2F] bg-[#202020] flex items-center justify-center text-[#A3A3A3] text-sm font-semibold">
              {selectedNode.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="z-20 w-80 backdrop-blur-md border border-[#212121] rounded-md shadow-lg p-4 transition-all duration-300">

            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">

                <h2 className="text-xl font-semibold text-[#EFEFEF] truncate pr-2 tracking-tight">{selectedNode.name}</h2>
              </div>
              <button onClick={() => setSelectedNodeId(null)} className="text-[#A3A3A3] hover:text-[#EFEFEF] transition-colors ml-2 flex-shrink-0">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {selectedNode.hometown && (
                <div>
                  <p className="text-xs text-[#A3A3A3] uppercase tracking-widest mb-1 font-medium">Hometown</p>
                  <p className="text-sm text-[#EFEFEF]">{selectedNode.hometown}</p>
                </div>
              )}

              {selectedNode.total_views != null && (
                <div>
                  <p className="text-xs text-[#A3A3A3] uppercase tracking-widest mb-1 font-medium">Total Views</p>
                  <p className="text-sm text-[#EFEFEF] font-mono">{selectedNode.total_views.toLocaleString()}</p>
                </div>
              )}

              <div className="border-t border-[#2F2F2F] pt-4 mt-4">
                <p className="text-xs text-[#A3A3A3] uppercase tracking-widest mb-3 font-medium">Battle Statistics</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#202020] p-3 rounded-md border border-[#2F2F2F]">
                    <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Matches</p>
                    <p className="text-lg font-mono text-[#EFEFEF]">{nodeStats[selectedNode.id]?.total || 0}</p>
                  </div>
                  <div className="bg-[#202020] p-3 rounded-md border border-[#2F2F2F]">
                    <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Win Rate</p>
                    <p className="text-lg font-mono" style={{ color: getWinRateColor(nodeStats[selectedNode.id]?.winRate || 0.5) }}>
                      {((nodeStats[selectedNode.id]?.winRate || 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-[#202020] p-3 rounded-md border border-[#2F2F2F]">
                    <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Wins</p>
                    <p className="text-lg font-mono text-[#4ade80]">{nodeStats[selectedNode.id]?.wins || 0}</p>
                  </div>
                  <div className="bg-[#202020] p-3 rounded-md border border-[#2F2F2F]">
                    <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Losses</p>
                    <p className="text-lg font-mono text-[#f87171]">{nodeStats[selectedNode.id]?.losses || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>)} */}

      {selectedNode && selectedNode.group === 'Emcee' && (
        <div className="absolute z-[40] bg-[#121212]/95 md:bg-[#121212]/30 backdrop-blur-xl md:backdrop-blur-md border-t border-white/10 md:border md:border-white/5 overflow-hidden flex flex-col transition-all duration-300 opacity-100 md:opacity-90 hover:md:opacity-100 max-md:w-full max-md:bottom-0 max-md:left-0 max-md:rounded-t-2xl max-md:rounded-b-none max-md:top-auto max-md:max-h-[70vh] md:w-80 md:left-6 md:top-24 md:rounded-lg shadow-2xl md:shadow-none pb-4 md:pb-0 pointer-events-auto">

          {/* Portrait Header */}
          <div className="relative w-full bg-transparent">
            {selectedNode.avatar_url ? (
              <Image
                src={selectedNode.avatar_url}
                alt={selectedNode.name}
                width={320}
                height={400}
                className="w-full h-full object-cover aspect-[4/5]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#A3A3A3] text-6xl font-bold font-mono border-b border-white/5">
                {selectedNode.name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => setSelectedNodeId(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-black/20 hover:bg-black/55 text-white/80 hover:text-white rounded-full border border-white/10 backdrop-blur-sm transition-all z-20"
            >
              ✕
            </button>

            {/* Gradient Overlay & Name */}
            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#121212]/70 via-[#121212]/30 to-transparent pt-20 pb-2 px-3">
              <h2 className="text-3xl font-bold text-[#EFEFEF] truncate tracking-tight">
                {selectedNode.name}
              </h2>
              {selectedNode.hometown && (
                <p className="text-sm text-[#A3A3A3] uppercase tracking-wider font-medium mt-1 truncate">
                  {selectedNode.hometown}
                </p>
              )}
            </div>
          </div>

          {/* Details Body */}
          <div className="px-3 pb-3 pt-2 space-y-5">
            {selectedNode.total_views != null && (
              <div className="flex justify-between items-end border-b border-white/5 pb-3">
                <p className="text-xs text-[#A3A3A3] uppercase tracking-widest font-medium">Total Views</p>
                <p className="text-lg text-[#EFEFEF] font-mono leading-none">{selectedNode.total_views.toLocaleString()}</p>
              </div>
            )}

            {/* Battle Statistics */}
            <div>
              <p className="text-xs text-[#A3A3A3] uppercase tracking-widest mb-3 font-medium">Battle Statistics</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/[0.02] p-3 rounded-md border border-white/5 flex flex-col justify-between transition-all hover:bg-white/[0.04]">
                  <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Matches</p>
                  <p className="text-xl font-mono text-[#EFEFEF] mt-1">{nodeStats[selectedNode.id]?.total || 0}</p>
                </div>
                <div className="bg-white/[0.02] p-3 rounded-md border border-white/5 flex flex-col justify-between transition-all hover:bg-white/[0.04]">
                  <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Win Rate</p>
                  <p className="text-xl font-mono mt-1" style={{ color: getWinRateColor(nodeStats[selectedNode.id]?.winRate || 0) }}>
                    {(nodeStats[selectedNode.id]?.winRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-white/[0.02] p-3 rounded-md border border-[#22c55e]/15 flex flex-col justify-between transition-all hover:bg-white/[0.04]">
                  <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Wins</p>
                  <p className="text-xl font-mono text-[#4ade80] mt-1">{nodeStats[selectedNode.id]?.wins || 0}</p>
                </div>
                <div className="bg-white/[0.02] p-3 rounded-md border border-[#ef4444]/15 flex flex-col justify-between transition-all hover:bg-white/[0.04]">
                  <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Losses</p>
                  <p className="text-xl font-mono text-[#f87171] mt-1">{nodeStats[selectedNode.id]?.losses || 0}</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}



      {/* Link Details Panel */}
      {selectedLink && selectedLink.type !== 'ATTENDED' && (() => {
        const sourceId = typeof selectedLink.source === 'object' ? selectedLink.source.id : selectedLink.source;
        const targetId = typeof selectedLink.target === 'object' ? selectedLink.target.id : selectedLink.target;
        const sourceName = graphData.nodes.find(n => n.id === sourceId)?.name || sourceId;
        const targetName = graphData.nodes.find(n => n.id === targetId)?.name || targetId;

        const sourceNode = graphData.nodes.find(n => n.id === sourceId);
        const targetNode = graphData.nodes.find(n => n.id === targetId);

        return (
          <div className="absolute z-[40] bg-[#121212]/95 md:bg-[#121212]/30 backdrop-blur-xl md:backdrop-blur-md border-t border-white/10 md:border md:border-white/5 overflow-hidden flex flex-col transition-all duration-300 opacity-100 md:opacity-90 hover:md:opacity-100 max-md:w-full max-md:bottom-0 max-md:left-0 max-md:rounded-t-2xl max-md:rounded-b-none max-md:top-auto max-md:max-h-[70vh] md:w-80 md:left-6 md:top-24 md:rounded-lg shadow-2xl md:shadow-none pb-4 md:pb-0 pointer-events-auto">
            {/* Matchup Header */}
            <div className="relative w-full bg-transparent aspect-[16/10] overflow-hidden flex items-center justify-center border-b border-white/5 shrink-0">
              {/* Background Graphic or Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#1E293B] opacity-50" />

              {/* Matchup Avatars */}
              <div className="relative z-10 flex items-center gap-6 mb-8 mt-2">
                {/* Source Emcee */}
                <div className="flex flex-col items-center">
                  {sourceNode?.avatar_url ? (
                    <Image
                      src={sourceNode.avatar_url}
                      alt={sourceName}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-full object-cover border-2 border-[#4ade80]/80 shadow-md"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-white/[0.05] border-2 border-[#4ade80]/80 flex items-center justify-center text-[#EFEFEF] font-bold text-lg shadow-md font-mono">
                      {sourceName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Matchup Type Indicator */}
                <div className="px-2.5 py-1 bg-black/40 backdrop-blur-sm rounded-full border border-white/5 text-[10px] font-bold text-[#A3A3A3] uppercase tracking-wider">
                  {selectedLink.type === 'DEFEATED' ? 'def.' : 'vs'}
                </div>

                {/* Target Emcee */}
                <div className="flex flex-col items-center">
                  {targetNode?.avatar_url ? (
                    <Image
                      src={targetNode.avatar_url}
                      alt={targetName}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-full object-cover border-2 border-[#f87171]/80 shadow-md"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-white/[0.05] border-2 border-[#f87171]/80 flex items-center justify-center text-[#EFEFEF] font-bold text-lg shadow-md font-mono">
                      {targetName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedLink(null)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-black/20 hover:bg-black/55 text-white/80 hover:text-white rounded-full border border-white/10 backdrop-blur-sm transition-all z-20"
              >
                ✕
              </button>

              {/* Gradient Overlay & Name */}
              <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#121212]/70 via-[#121212]/30 to-transparent pt-12 pb-2 px-3">
                <h2 className="text-xl font-bold text-[#EFEFEF] truncate tracking-tight">
                  {selectedLink.battle_name || 'Battle Details'}
                </h2>
                {selectedLink.event_name && (
                  <p className="text-xs text-[#A3A3A3] uppercase tracking-wider font-medium mt-1 truncate">
                    {selectedLink.event_name}
                  </p>
                )}
              </div>
            </div>

            {/* Details Body */}
            <div className="px-3 pb-3 pt-2 space-y-5">
              {selectedLink.view_count != null && (
                <div className="flex justify-between items-end border-b border-white/5 pb-3">
                  <p className="text-xs text-[#A3A3A3] uppercase tracking-widest font-medium">Views</p>
                  <p className="text-lg text-[#EFEFEF] font-mono leading-none">{selectedLink.view_count.toLocaleString()}</p>
                </div>
              )}

              {/* Battle Info Grid */}
              <div>
                <p className="text-xs text-[#A3A3A3] uppercase tracking-widest mb-3 font-medium">Battle Info</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/[0.02] p-3 rounded-md border border-white/5 flex flex-col justify-between transition-all hover:bg-white/[0.04]">
                    <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Format</p>
                    <p className="text-sm font-mono text-[#EFEFEF] mt-1">{FORMAT_LABELS[selectedLink.match_format] || selectedLink.match_format || 'N/A'}</p>
                  </div>
                  <div className="bg-white/[0.02] p-3 rounded-md border border-white/5 flex flex-col justify-between transition-all hover:bg-white/[0.04]">
                    <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Type</p>
                    <p className="text-sm font-mono text-[#EFEFEF] mt-1">{MATCH_TYPE_LABELS[selectedLink.match_type] || selectedLink.match_type || 'N/A'}</p>
                  </div>
                  <div className="bg-white/[0.02] p-3 rounded-md border border-white/5 flex flex-col justify-between transition-all hover:bg-white/[0.04]">
                    <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Year</p>
                    <p className="text-sm font-mono text-[#EFEFEF] mt-1">{selectedLink.year || 'N/A'}</p>
                  </div>
                  <div className={`bg-white/[0.02] p-3 rounded-md flex flex-col justify-between border ${selectedLink.type === 'DEFEATED' ? 'border-[#22c55e]/15' : 'border-white/5'
                    } transition-all hover:bg-white/[0.04]`}>
                    <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Outcome</p>
                    <p className={`text-sm font-mono mt-1 truncate ${selectedLink.type === 'DEFEATED' ? 'text-[#4ade80]' : 'text-[#EFEFEF]'
                      }`} title={selectedLink.type === 'DEFEATED' ? `${sourceName} won` : 'Draw'}>
                      {selectedLink.type === 'DEFEATED' ? `${sourceName} won` : 'Draw'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-20 w-64 select-none pointer-events-auto transition-all duration-300 opacity-60 hover:opacity-100 max-md:hidden">
        {/* Toggle Node Size Basis */}
        <div className="mb-4 flex flex-col gap-2">
          <p className="text-[9px] text-[#555] uppercase tracking-widest font-bold">Node Size Basis</p>
          <div className="flex gap-4 border-b border-[#222] pb-1.5 w-full">
            <button
              onClick={() => setSizeBasis('battles')}
              className={`text-[10px] font-bold tracking-wider transition-all -mb-[7px] pb-1 cursor-pointer ${
                sizeBasis === 'battles' 
                  ? 'text-[#EFEFEF] border-b border-[#EFEFEF]' 
                  : 'text-[#555] hover:text-[#A3A3A3]'
              }`}
            >
              BATTLES
            </button>
            <button
              onClick={() => setSizeBasis('views')}
              className={`text-[10px] font-bold tracking-wider transition-all -mb-[7px] pb-1 cursor-pointer ${
                sizeBasis === 'views' 
                  ? 'text-[#EFEFEF] border-b border-[#EFEFEF]' 
                  : 'text-[#555] hover:text-[#A3A3A3]'
              }`}
            >
              VIEWS
            </button>
          </div>
        </div>

        {mode === 'Hierarchy' ? (
          <div className="flex gap-6 mt-4">
            <div className="space-y-1.5">
              <p className="text-[9px] text-[#555] uppercase tracking-widest font-bold">Nodes</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#4ade80]"></div>
                <span className="text-[10px] text-[#A3A3A3] font-medium">Emcee Win Rate</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[9px] text-[#555] uppercase tracking-widest font-bold">Edges</p>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-[#FFD700]"></div>
                <span className="text-[10px] text-[#A3A3A3] font-medium">Tournament</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-[#718096]"></div>
                <span className="text-[10px] text-[#A3A3A3] font-medium">Non-Tournament</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-6 mt-4">
            <div className="space-y-1.5 flex-1">
              <p className="text-[9px] text-[#555] uppercase tracking-widest font-bold">Nodes</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#4ade80]"></div>
                <span className="text-[10px] text-[#A3A3A3] font-medium">Emcee Win Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#ffb84d]"></div>
                <span className="text-[10px] text-[#A3A3A3] font-medium">Event</span>
              </div>
            </div>
            <div className="space-y-1.5 flex-1">
              <p className="text-[9px] text-[#555] uppercase tracking-widest font-bold">Edges</p>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-0.5 bg-[#FFD700]"></div>
                <span className="text-[10px] text-[#A3A3A3] font-medium">Tournament</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-0.5 bg-[#ec4899]"></div>
                <span className="text-[10px] text-[#A3A3A3] font-medium">Promo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-0.5 bg-[#06b6d4]"></div>
                <span className="text-[10px] text-[#A3A3A3] font-medium">Tryout</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-0.5 bg-[#718096]"></div>
                <span className="text-[10px] text-[#A3A3A3] font-medium">Defeated / Battled</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-0.5 bg-[#ffb84d]"></div>
                <span className="text-[10px] text-[#A3A3A3] font-medium">Attended Event</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
