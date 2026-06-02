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
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-3xl font-semibold text-[#FFFFFF] tracking-tight drop-shadow-md mb-1">Fliptop Battles 3D</h1>
          <p className="text-[#A3A3A3] text-sm drop-shadow-md">
            Interactive WebGL visualization of Emcees, Battles, and Events.
          </p>
        </div>
        <Link href="/admin" className="pointer-events-auto text-sm text-[#5E87C9] hover:text-[#7ba2e0] transition-colors bg-black/50 px-3 py-1 rounded backdrop-blur-sm">
          Admin Login &rarr;
        </Link>
      </div>

      <div className="w-full h-full">
        <GraphClient graphData={graphData} />
      </div>
    </div>
  );
}
