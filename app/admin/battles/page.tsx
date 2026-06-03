import { getNeo4jDriver } from '@/lib/neo4j';
import { syncBattlesFromSupabase, updateBattle, createBattle, deleteBattle } from '../actions';
import BattlesClientPage from './BattlesClientPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BattlesAdminPage() {
  const driver = getNeo4jDriver();
  const session = driver.session();
  let battles: any[] = [];
  let events: { id: string; name: string }[] = [];

  try {
    const result = await session.run(`
      MATCH (b:Battle)
      OPTIONAL MATCH (b)-[:HELD_AT]->(e:Event)
      RETURN b, e.id AS event_id
      ORDER BY b.name ASC
    `);
    battles = result.records.map((record) => {
      const bProps = record.get('b').properties;
      return { ...bProps, event_id: record.get('event_id') };
    });

    const eventsResult = await session.run(`
      MATCH (e:Event)
      RETURN e.id AS id, e.name AS name
      ORDER BY e.year DESC
    `);
    events = eventsResult.records.map(r => ({ id: r.get('id'), name: r.get('name') }));
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
        availableEvents={events}
        syncAction={syncBattlesFromSupabase}
        updateAction={updateBattle}
        createAction={createBattle}
        deleteAction={deleteBattle}
      />
    </div>
  );
}
