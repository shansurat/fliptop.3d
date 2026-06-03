import { getNeo4jDriver } from '@/lib/neo4j';
import EmceesClientPage from './EmceesClientPage';
import { syncFromSupabase, updateEmcee, createEmcee, deleteEmcee } from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Neo4jAdminPage() {
  const driver = getNeo4jDriver();
  const session = driver.session();
  let emcees = [];

  try {
    const result = await session.run('MATCH (e:Emcee) RETURN e ORDER BY e.stage_name ASC');
    emcees = result.records.map((record) => record.get('e').properties);
  } catch (error) {
    console.error('Error fetching from Neo4j:', error);
  } finally {
    await session.close();
  }

  return (
    <div className="w-full">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-[#FFFFFF] tracking-tight mb-2">Emcees</h1>
        <p className="text-[#A3A3A3] text-sm">
          Directly manage graph database nodes and synchronize records from Supabase.
        </p>
      </div>

      <EmceesClientPage 
        initialEmcees={emcees} 
        syncAction={syncFromSupabase} 
        updateAction={updateEmcee} 
        createAction={createEmcee}
        deleteAction={deleteEmcee}
      />
    </div>
  );
}
