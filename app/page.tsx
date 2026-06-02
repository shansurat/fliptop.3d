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
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-0.5 p-1 bg-[#191919] rounded-md border border-[#2F2F2F] shadow-sm">
        <Link 
          href="/" 
          className="px-5 py-1.5 rounded-sm text-sm font-medium transition-colors bg-[#2F2F2F] text-[#EFEFEF]"
        >
          Standard
        </Link>
        <Link 
          href="/hierarchy" 
          className="px-5 py-1.5 rounded-sm text-sm font-medium transition-colors text-[#A3A3A3] hover:text-[#EFEFEF] hover:bg-[#252525]"
        >
          Hierarchy
        </Link>
      </div>

      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-3xl font-semibold text-[#FFFFFF] tracking-tight drop-shadow-md mb-1">Fliptop Battles 3D</h1>
          <p className="text-[#A3A3A3] text-sm drop-shadow-md">
            Interactive WebGL visualization of Emcees, Battles, and Events.
          </p>
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-10 pointer-events-auto">
        <Link href="/admin" className="text-sm text-[#A3A3A3] hover:text-[#EFEFEF] transition-colors bg-[#191919] border border-[#2F2F2F] shadow-sm px-4 py-2 rounded-md">
          Admin &rarr;
        </Link>
      </div>

      <div className="w-full h-full">
        <GraphClient graphData={graphData} mode="Standard" />
      </div>
    </div>
  );
}
