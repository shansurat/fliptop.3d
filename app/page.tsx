import { fetchGraphDataForVisualization } from './actions';
import GraphClient from './ForceGraphWrapper';


export const dynamicConfig = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';

export default async function VisualizationAdminPage() {
  const result = await fetchGraphDataForVisualization();

  const graphData = result.success && result.data ? result.data : { nodes: [], links: [] };

  return (
    <div className="w-full h-screen bg-black text-white relative overflow-hidden">
      {/* Top-Center Mode Navigation */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-0.5 p-1 bg-[#121212]/30 backdrop-blur-md border border-white/5 rounded-md opacity-80 hover:opacity-100 transition-opacity duration-300">
        <Link
          href="/"
          className="px-4 py-1.5 rounded-md text-xs font-medium transition-all bg-white/[0.07] text-[#EFEFEF]"
        >
          Standard
        </Link>
        <Link
          href="/hierarchy"
          className="px-4 py-1.5 rounded-md text-xs font-medium transition-all text-[#A3A3A3] hover:text-[#EFEFEF] hover:bg-white/[0.03]"
        >
          Hierarchy
        </Link>
      </div>

      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10 pointer-events-none">
        <div className="pointer-events-auto opacity-60 hover:opacity-100 transition-opacity duration-300 select-none">
          <h1 className="text-lg font-bold text-[#EFEFEF] tracking-widest uppercase mb-1">fliptop.3d</h1>
          <p className="text-[#666] text-[10px] tracking-wider uppercase max-w-xs leading-relaxed">
            Interactive WebGL visualization of Emcees, Battles, and Events.
          </p>
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-10 pointer-events-auto flex items-center gap-2">
        <Link href="/presentation?slide=0" className="text-sm text-[#A3A3A3] hover:text-[#EFEFEF] transition-all bg-transparent px-3 py-2 rounded-md opacity-60 hover:opacity-100 flex items-center gap-1.5">
          <svg className="w-4 h-4 shrink-0 text-[#a3a3a3]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          Present
        </Link>
        <Link href="/admin" className="text-sm text-[#A3A3A3] hover:text-[#EFEFEF] transition-all bg-transparent px-3 py-2 rounded-md opacity-60 hover:opacity-100">
          Admin &rarr;
        </Link>
      </div>

      <div className="w-full h-full">
        <GraphClient graphData={graphData} mode="Standard" />
      </div>


    </div>
  );
}
