'use client'

import { useRef, useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

interface GraphData {
  nodes: { id: string; name: string; val: number; group?: string; hometown?: string | null; total_views?: number | null }[];
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

export default function GraphClient({ graphData, mode }: { graphData: GraphData, mode: 'Standard' | 'Hierarchy' }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [selectedMatchType, setSelectedMatchType] = useState<string>('All');
  const [selectedFormat, setSelectedFormat] = useState<string>('All');
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return graphData.nodes.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId, graphData]);

  // Reset selection on filter changes
  useEffect(() => {
    setSelectedNodeId(null);
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

  const filteredSearchNodes = useMemo(() => {
    if (!searchQuery) return [];
    return displayData.nodes
      .filter(n => n.group === 'Emcee' && n.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 10);
  }, [searchQuery, displayData.nodes]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSearchSelect = (node: any) => {
    setSearchQuery('');
    setShowSearchDropdown(false);
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
  };

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
  }, [displayData, mode]);

  return (
    <div ref={containerRef} className="w-full h-full relative group font-sans">
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 opacity-80 group-hover:opacity-100 transition-opacity w-64">

        {/* Search Bar */}
        <div className="relative w-full">
          <input
            type="text"
            placeholder="Search Emcee..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchDropdown(true);
            }}
            onFocus={() => setShowSearchDropdown(true)}
            className="w-full bg-[#191919] text-[#EFEFEF] border border-[#2F2F2F] rounded-md px-3 py-2 text-sm outline-none focus:border-[#5E87C9] placeholder-[#555] shadow-sm"
          />
          {showSearchDropdown && searchQuery && filteredSearchNodes.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-[#191919] border border-[#2F2F2F] rounded-md shadow-lg overflow-hidden z-20">
              {filteredSearchNodes.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleSearchSelect(n)}
                  className="w-full text-left px-3 py-2 text-sm text-[#EFEFEF] hover:bg-[#2F2F2F] transition-colors"
                >
                  {n.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#191919] border border-[#2F2F2F] shadow-sm rounded-md px-3 py-2 flex items-center justify-between gap-2">
          <label htmlFor="year-select" className="text-sm text-[#A3A3A3]">Year</label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-[#202020] text-[#EFEFEF] border border-[#373737] rounded-md px-2 py-1 text-sm outline-none focus:border-[#5E87C9] w-32"
          >
            <option value="All">All Years</option>
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="bg-[#191919] border border-[#2F2F2F] shadow-sm rounded-md px-3 py-2 flex items-center justify-between gap-2">
          <label htmlFor="type-select" className="text-sm text-[#A3A3A3]">Type</label>
          <select
            id="type-select"
            value={selectedMatchType}
            onChange={(e) => setSelectedMatchType(e.target.value)}
            className="bg-[#202020] text-[#EFEFEF] border border-[#373737] rounded-md px-2 py-1 text-sm outline-none focus:border-[#5E87C9] w-32"
          >
            <option value="All">All Types</option>
            {availableMatchTypes.map(t => (
              <option key={t} value={t}>{MATCH_TYPE_LABELS[t] || t}</option>
            ))}
          </select>
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
            if (mode === 'Hierarchy') {
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
            if (mode === 'Hierarchy' && fgRef.current) {
              fgRef.current.zoomToFit(400);
            }
          }}
        />
      )}

      {/* Node Details Panel */}
      {selectedNode && selectedNode.group === 'Emcee' && (
        <div className="absolute left-6 top-24 z-20 w-80 bg-[#191919]/95 backdrop-blur-md border border-[#2F2F2F] rounded-md shadow-lg p-5 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold text-[#EFEFEF] truncate pr-2 tracking-tight">{selectedNode.name}</h2>
            <button onClick={() => setSelectedNodeId(null)} className="text-[#A3A3A3] hover:text-[#EFEFEF] transition-colors">
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
      )}

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-20 bg-[#191919]/90 backdrop-blur-md border border-[#2F2F2F] rounded-md p-4 shadow-sm pointer-events-none select-none">
        <h3 className="text-xs text-[#A3A3A3] uppercase tracking-widest font-medium mb-3">Legend</h3>
        
        <div className="flex gap-8">
          <div className="space-y-2">
            <p className="text-[10px] text-[#888] mb-2 uppercase tracking-wider font-semibold">Nodes</p>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#4ade80]"></div>
              <span className="text-xs text-[#EFEFEF]">Emcee Win Rate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#ffb84d]"></div>
              <span className="text-xs text-[#EFEFEF]">Event</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-[#888] mb-2 uppercase tracking-wider font-semibold">Edges</p>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-[#FFD700]"></div>
              <span className="text-xs text-[#EFEFEF]">Tournament</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-[#ec4899]"></div>
              <span className="text-xs text-[#EFEFEF]">Promo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-[#06b6d4]"></div>
              <span className="text-xs text-[#EFEFEF]">Tryout</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-[#718096]"></div>
              <span className="text-xs text-[#EFEFEF]">Defeated / Battled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-[#ffb84d]"></div>
              <span className="text-xs text-[#EFEFEF]">Attended Event</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
