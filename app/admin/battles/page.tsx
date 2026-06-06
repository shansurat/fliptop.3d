import { getNeo4jDriver } from '@/lib/neo4j';
import { syncBattlesFromSupabase, syncBattleRelationships, deleteBattle, saveBattleAndResult } from '../actions';
import BattlesClientPage from './BattlesClientPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BattlesAdminPage() {
  const driver = getNeo4jDriver();
  const session = driver.session();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let battles: any[] = [];
  let emcees: { id: string; stage_name: string }[] = [];

  try {
    const result = await session.run(`
      MATCH (b:Battle)
      OPTIONAL MATCH (e1:Emcee)-[r]->(e2:Emcee) WHERE r.battle_id = b.id AND type(r) IN ['BATTLED', 'DEFEATED']
      WITH b,
           CASE WHEN r IS NOT NULL THEN {
             e1_id: e1.id,
             e1_name: e1.stage_name,
             e2_id: e2.id,
             e2_name: e2.stage_name,
             outcome: type(r)
           } ELSE null END AS rel
      WITH b, collect(rel) AS rels
      RETURN b,
             [r in rels WHERE r is not null] AS relationships
      ORDER BY b.name ASC
    `);
    battles = result.records.map((record) => {
      const bProps = record.get('b').properties;
      const rels = record.get('relationships') || [];
      const rel = rels[0] || null;
      return {
        ...bProps,
        e1_id: rel ? rel.e1_id : null,
        e1_name: rel ? rel.e1_name : null,
        e2_id: rel ? rel.e2_id : null,
        e2_name: rel ? rel.e2_name : null,
        outcome: rel ? rel.outcome : null
      };
    });

    const emceesResult = await session.run(`
      MATCH (e:Emcee)
      RETURN e.id AS id, e.stage_name AS name
      ORDER BY e.stage_name ASC
    `);
    emcees = emceesResult.records.map(r => ({ id: r.get('id'), stage_name: r.get('name') }));

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
          Manage battles and outcome results in a single unified dashboard, sync data from Supabase.
        </p>
      </div>

      <BattlesClientPage
        initialBattles={battles}
        availableEmcees={emcees}
        syncAction={syncBattlesFromSupabase}
        syncRelationshipsAction={syncBattleRelationships}
        saveAction={saveBattleAndResult}
        deleteAction={deleteBattle}
      />
    </div>
  );
}
