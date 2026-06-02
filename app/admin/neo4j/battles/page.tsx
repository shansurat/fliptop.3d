import { getNeo4jDriver } from '@/lib/neo4j';
import { syncBattlesFromSupabase, updateBattle } from '../actions';
import BattlesClientPage from './BattlesClientPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BattlesAdminPage() {
  const driver = getNeo4jDriver();
  const session = driver.session();
  let battles = [];

  try {
    const result = await session.run('MATCH (b:Battle) RETURN b ORDER BY b.name ASC');
    battles = result.records.map((record) => record.get('b').properties);
  } catch (error) {
    console.error('Error fetching from Neo4j:', error);
  } finally {
    await session.close();
  }

  return (
    <div className="w-full">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-[#FFFFFF] tracking-tight mb-2">Battles</h1>
        <p className="text-[#A3A3A3] text-sm">
          Manage battle graph nodes and synchronize records from Supabase.
        </p>
      </div>

      <BattlesClientPage
        initialBattles={battles}
        syncAction={syncBattlesFromSupabase}
        updateAction={updateBattle}
      />
    </div>
  );
}
