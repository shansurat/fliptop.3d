'use client'

import { useRef, useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

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
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 opacity-80 group-hover:opacity-100 transition-opacity w-64">

        <div className='flex gap-2'>
          <select
            id="year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-[#202020] text-[#EFEFEF] border border-[#373737] rounded-sm px-3 py-2 text-sm outline-none focus:border-[#5E87C9] w-32"
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
            className="bg-[#202020] text-[#EFEFEF] border border-[#373737] rounded-sm px-3 py-2 text-sm outline-none focus:border-[#5E87C9] w-32"
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
            className="w-full bg-[#191919] text-[#EFEFEF] border border-[#2F2F2F] rounded-md px-3 py-2 text-sm outline-none focus:border-[#5E87C9] placeholder-[#555] shadow-sm"
          />
        </div>

        {mode !== 'Hierarchy' && (
          <div className="bg-[#191919] border border-[#2F2F2F] shadow-sm rounded-md px-3 py-2 flex items-center justify-between gap-2">
            <label htmlFor="format-select" className="text-sm text-[#A3A3A3]">Format</label>
            <select
              id="format-select"
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="bg-[#202020] text-[#EFEFEF] border border-[#373737] rounded-md px-2 py-1 text-sm outline-none focus:border-[#5E87C9] w-32"
            >
              <option value="All">All Formats</option>
              {availableFormats.map(f => (
                <option key={f} value={f}>{FORMAT_LABELS[f] || f}</option>
              ))}
            </select>
          </div>
        )}

        {/* Scrollable Emcees List */}
        <div className="bg-[#191919] border border-[#2F2F2F] shadow-sm rounded-md flex flex-col overflow-hidden max-h-[300px]">
          <div className="px-3 py-1.5 border-b border-[#2F2F2F] flex justify-between items-center bg-[#151515] shrink-0">
            <span className="text-xs text-[#A3A3A3] uppercase tracking-wider font-semibold">Emcees ({filteredEmceesList.length})</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#202020] text-[#A3A3A3] border border-[#2F2F2F] rounded-md px-2 py-0.5 text-[10px] outline-none focus:border-[#5E87C9] w-24 hover:text-[#EFEFEF] transition-colors cursor-pointer"
            >
              <option value="name">Sort: Name</option>
              <option value="winRate">Sort: Win Rate</option>
              <option value="views">Sort: Views</option>
              <option value="wins">Sort: Wins</option>
              <option value="losses">Sort: Losses</option>
            </select>
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-[#232323] scrollbar-thin">
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
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
                      isSelected ? 'bg-[#2F2F2F] text-[#EFEFEF]' : 'text-[#D0D0D0] hover:bg-[#252525] hover:text-[#EFEFEF]'
                    }`}
                  >
                    {hasAvatar ? (
                      <img
                        src={emcee.avatar_url!}
                        alt={emcee.name}
                        className="w-5 h-5 rounded-full object-cover shrink-0 border border-[#444]"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-[#333] flex items-center justify-center text-[9px] text-[#A3A3A3] font-bold shrink-0 font-mono">
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
              if (highlightLinks.has(link)) return '#FFFFFF';
              return '#222222'; // Dimmed
            }
            if (link.type === 'ATTENDED') return '#ffb84d';
            if (link.match_type === 'tournament') return '#FFD700';
            if (link.match_type === 'promo') return '#ec4899';
            if (link.match_type === 'tryout') return '#06b6d4';
            if (link.type === 'DEFEATED') return '#718096';
            return '#888888';
          }}
          linkOpacity={0.6}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkWidth={(link: any) => {
            let baseWidth = 1; // Default to 1 for better visibility
            if (link.type === 'DEFEATED' || link.type === 'BATTLED') {
              if (['2v2', '3v3', '5v5'].includes(link.match_format)) baseWidth = 2;
            } else if (link.type === 'ATTENDED') {
              baseWidth = 0.5;
            }

            if (selectedNodeId || selectedLink) {
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
            if (selectedNodeId || selectedLink) {
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
            if ((selectedNodeId || selectedLink) && highlightLinks.has(link)) {
              return -0.01; // Negative speed reverses flow (In for win, Out for defeat)
            }
            if (link.match_type === 'tournament') return 0.008;
            if (link.match_format === 'royal_rumble') return 0.012;
            return 0.004;
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkDirectionalParticleWidth={(link: any) => {
            if ((selectedNodeId || selectedLink) && highlightLinks.has(link)) {
              return 5; // Extra large particles for highlighted links
            }
            if (link.match_type === 'tournament') return 3;
            if (['2v2', '3v3', '5v5'].includes(link.match_format)) return 2.5;
            if (link.match_format === 'royal_rumble') return 2;
            return 1.5;
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
        <div className="absolute left-6 top-24 z-20 w-80 bg-[#121212]/95 backdrop-blur-xl border border-[#2F2F2F] rounded-md shadow-2xl overflow-hidden flex flex-col transition-all duration-300">

          {/* Portrait Header */}
          <div className="relative w-full  bg-[#202020]">
            {selectedNode.avatar_url ? (
              <img
                src={selectedNode.avatar_url}
                alt={selectedNode.name}
                className="w-full h-full object-cover aspect-[4/5]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#A3A3A3] text-6xl font-bold font-mono border-b border-[#2F2F2F]">
                {selectedNode.name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => setSelectedNodeId(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-colors"
            >
              ✕
            </button>

            {/* Gradient Overlay & Name */}
            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#121212] via-[#121212]/80 to-transparent pt-20 pb-2 px-3">
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
              <div className="flex justify-between items-end border-b border-[#2F2F2F] pb-3">
                <p className="text-xs text-[#A3A3A3] uppercase tracking-widest font-medium">Total Views</p>
                <p className="text-lg text-[#EFEFEF] font-mono leading-none">{selectedNode.total_views.toLocaleString()}</p>
              </div>
            )}

            {/* Battle Statistics */}
            <div>
              <p className="text-xs text-[#A3A3A3] uppercase tracking-widest mb-3 font-medium">Battle Statistics</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#1A1A1A] p-3 rounded-md border border-[#2F2F2F] flex flex-col justify-between">
                  <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Matches</p>
                  <p className="text-xl font-mono text-[#EFEFEF] mt-1">{nodeStats[selectedNode.id]?.total || 0}</p>
                </div>
                <div className="bg-[#1A1A1A] p-3 rounded-md border border-[#2F2F2F] flex flex-col justify-between">
                  <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Win Rate</p>
                  <p className="text-xl font-mono mt-1" style={{ color: getWinRateColor(nodeStats[selectedNode.id]?.winRate || 0) }}>
                    {(nodeStats[selectedNode.id]?.winRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-[#1A1A1A] p-3 rounded-md border border-[#22c55e]/20 flex flex-col justify-between">
                  <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Wins</p>
                  <p className="text-xl font-mono text-[#4ade80] mt-1">{nodeStats[selectedNode.id]?.wins || 0}</p>
                </div>
                <div className="bg-[#1A1A1A] p-3 rounded-md border border-[#ef4444]/20 flex flex-col justify-between">
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
          <div className="absolute left-6 top-24 z-20 w-80 bg-[#121212]/95 backdrop-blur-xl border border-[#2F2F2F] rounded-md shadow-2xl overflow-hidden flex flex-col transition-all duration-300">
            {/* Matchup Header */}
            <div className="relative w-full bg-[#202020] aspect-[16/10] overflow-hidden flex items-center justify-center border-b border-[#2F2F2F] shrink-0">
              {/* Background Graphic or Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#1E293B] opacity-50" />
              
              {/* Matchup Avatars */}
              <div className="relative z-10 flex items-center gap-6 mb-8 mt-2">
                {/* Source Emcee */}
                <div className="flex flex-col items-center">
                  {sourceNode?.avatar_url ? (
                    <img
                      src={sourceNode.avatar_url}
                      alt={sourceName}
                      className="w-14 h-14 rounded-full object-cover border-2 border-[#4ade80] shadow-lg"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[#1A1A1A] border-2 border-[#4ade80] flex items-center justify-center text-[#EFEFEF] font-bold text-lg shadow-lg font-mono">
                      {sourceName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Matchup Type Indicator */}
                <div className="px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full border border-[#2F2F2F] text-[10px] font-bold text-[#A3A3A3] shadow-md uppercase tracking-wider">
                  {selectedLink.type === 'DEFEATED' ? 'def.' : 'vs'}
                </div>

                {/* Target Emcee */}
                <div className="flex flex-col items-center">
                  {targetNode?.avatar_url ? (
                    <img
                      src={targetNode.avatar_url}
                      alt={targetName}
                      className="w-14 h-14 rounded-full object-cover border-2 border-[#f87171] shadow-lg"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[#1A1A1A] border-2 border-[#f87171] flex items-center justify-center text-[#EFEFEF] font-bold text-lg shadow-lg font-mono">
                      {targetName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedLink(null)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-colors z-20"
              >
                ✕
              </button>

              {/* Gradient Overlay & Name */}
              <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#121212] via-[#121212]/80 to-transparent pt-12 pb-2 px-3">
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
                <div className="flex justify-between items-end border-b border-[#2F2F2F] pb-3">
                  <p className="text-xs text-[#A3A3A3] uppercase tracking-widest font-medium">Views</p>
                  <p className="text-lg text-[#EFEFEF] font-mono leading-none">{selectedLink.view_count.toLocaleString()}</p>
                </div>
              )}

              {/* Battle Info Grid */}
              <div>
                <p className="text-xs text-[#A3A3A3] uppercase tracking-widest mb-3 font-medium">Battle Info</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#1A1A1A] p-3 rounded-md border border-[#2F2F2F] flex flex-col justify-between">
                    <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Format</p>
                    <p className="text-sm font-mono text-[#EFEFEF] mt-1">{FORMAT_LABELS[selectedLink.match_format] || selectedLink.match_format || 'N/A'}</p>
                  </div>
                  <div className="bg-[#1A1A1A] p-3 rounded-md border border-[#2F2F2F] flex flex-col justify-between">
                    <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Type</p>
                    <p className="text-sm font-mono text-[#EFEFEF] mt-1">{MATCH_TYPE_LABELS[selectedLink.match_type] || selectedLink.match_type || 'N/A'}</p>
                  </div>
                  <div className="bg-[#1A1A1A] p-3 rounded-md border border-[#2F2F2F] flex flex-col justify-between">
                    <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Year</p>
                    <p className="text-sm font-mono text-[#EFEFEF] mt-1">{selectedLink.year || 'N/A'}</p>
                  </div>
                  <div className={`bg-[#1A1A1A] p-3 rounded-md flex flex-col justify-between border ${
                    selectedLink.type === 'DEFEATED' ? 'border-[#22c55e]/20' : 'border-[#2F2F2F]'
                  }`}>
                    <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Outcome</p>
                    <p className={`text-sm font-mono mt-1 truncate ${
                      selectedLink.type === 'DEFEATED' ? 'text-[#4ade80]' : 'text-[#EFEFEF]'
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
      <div className="absolute bottom-6 left-6 z-20 bg-[#121212]/95 backdrop-blur-xl border border-[#2F2F2F] rounded-md p-4 shadow-2xl transition-all duration-300 w-64 select-none pointer-events-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs text-[#A3A3A3] uppercase tracking-widest font-semibold">Legend</h3>
        </div>

        {/* Toggle Node Size Basis */}
        <div className="mb-4 pb-3 border-b border-[#2F2F2F] flex flex-col gap-1.5">
          <p className="text-[10px] text-[#888] uppercase tracking-wider font-semibold">Node Size Basis</p>
          <div className="flex gap-0.5 p-1 bg-[#191919] rounded-md border border-[#2F2F2F] w-full">
            <button
              onClick={() => setSizeBasis('battles')}
              className={`flex-1 py-1 rounded-sm text-[10px] font-medium transition-colors ${
                sizeBasis === 'battles' 
                  ? 'bg-[#2F2F2F] text-[#EFEFEF]' 
                  : 'text-[#A3A3A3] hover:text-[#EFEFEF] hover:bg-[#202020]'
              }`}
            >
              Battles
            </button>
            <button
              onClick={() => setSizeBasis('views')}
              className={`flex-1 py-1 rounded-sm text-[10px] font-medium transition-colors ${
                sizeBasis === 'views' 
                  ? 'bg-[#2F2F2F] text-[#EFEFEF]' 
                  : 'text-[#A3A3A3] hover:text-[#EFEFEF] hover:bg-[#202020]'
              }`}
            >
              Views
            </button>
          </div>
        </div>

        {mode === 'Hierarchy' ? (
          <div className="flex gap-8">
            <div className="space-y-2">
              <p className="text-[10px] text-[#888] mb-1.5 uppercase tracking-wider font-semibold">Nodes</p>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded bg-[#4ade80]"></div>
                <span className="text-[11px] text-[#EFEFEF]">Emcee Win Rate</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-[#888] mb-1.5 uppercase tracking-wider font-semibold">Edges</p>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-0.5 bg-[#FFD700]"></div>
                <span className="text-[11px] text-[#EFEFEF]">Tournament</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-0.5 bg-[#718096]"></div>
                <span className="text-[11px] text-[#EFEFEF]">Non-Tournament</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-8">
            <div className="space-y-2 flex-1">
              <p className="text-[10px] text-[#888] mb-1.5 uppercase tracking-wider font-semibold">Nodes</p>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded bg-[#4ade80]"></div>
                <span className="text-[11px] text-[#EFEFEF]">Emcee Win Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded bg-[#ffb84d]"></div>
                <span className="text-[11px] text-[#EFEFEF]">Event</span>
              </div>
            </div>
            <div className="space-y-2 flex-1">
              <p className="text-[10px] text-[#888] mb-1.5 uppercase tracking-wider font-semibold">Edges</p>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-0.5 bg-[#FFD700]"></div>
                <span className="text-[11px] text-[#EFEFEF]">Tournament</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-0.5 bg-[#ec4899]"></div>
                <span className="text-[11px] text-[#EFEFEF]">Promo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-0.5 bg-[#06b6d4]"></div>
                <span className="text-[11px] text-[#EFEFEF]">Tryout</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-0.5 bg-[#718096]"></div>
                <span className="text-[11px] text-[#EFEFEF]">Defeated / Battled</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-0.5 bg-[#ffb84d]"></div>
                <span className="text-[11px] text-[#EFEFEF]">Attended Event</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
