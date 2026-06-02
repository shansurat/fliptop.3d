import { fetchGraphDataForVisualization } from '../actions';
import GraphClient from './ForceGraphWrapper';

export const dynamicConfig = 'force-dynamic';
export const revalidate = 0;

export default async function VisualizationAdminPage() {
  const result = await fetchGraphDataForVisualization();
  
  const graphData = result.success && result.data ? result.data : { nodes: [], links: [] };

  return (
    <div className="w-full h-[85vh] flex flex-col">
      <div className="mb-4">
        <h1 className="text-3xl font-semibold text-[#FFFFFF] tracking-tight mb-2">3D Graph Visualization</h1>
        <p className="text-[#A3A3A3] text-sm">
          Interactive WebGL visualization of Emcees, Battles, and Events. Drag to rotate, scroll to zoom.
        </p>
      </div>

      <div className="flex-grow border border-[#2f2f2f] rounded overflow-hidden">
        <GraphClient graphData={graphData} />
      </div>
    </div>
  );
}
