import { getNeo4jDriver } from '@/lib/neo4j';
import ParticipantsClientPage from './ParticipantsClientPage';
import { syncBattleRelationships, updateRelationshipOutcome, createRelationship, deleteRelationship } from '../actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ParticipantsAdminPage() {
  const driver = getNeo4jDriver();
  const session = driver.session();
  let relationships: {
    e1_id: string;
    e1_name: string;
    e2_id: string;
    e2_name: string;
    battle_id: string;
    outcome: 'DEFEATED' | 'BATTLED';
  }[] = [];
  let emcees: { id: string; stage_name: string }[] = [];
  let battles: { id: string; name: string }[] = [];

  try {
    const result = await session.run(`
      MATCH (e1:Emcee)-[r]->(e2:Emcee)
      WHERE type(r) IN ['BATTLED', 'DEFEATED']
      RETURN e1.id AS e1_id, e1.stage_name AS e1_name, type(r) AS outcome, e2.id AS e2_id, e2.stage_name AS e2_name, r.battle_id AS battle_id
      ORDER BY r.battle_id ASC
    `);

    relationships = result.records.map((record) => ({
      e1_id: record.get('e1_id'),
      e1_name: record.get('e1_name'),
      e2_id: record.get('e2_id'),
      e2_name: record.get('e2_name'),
      battle_id: record.get('battle_id'),
      outcome: record.get('outcome') as 'DEFEATED' | 'BATTLED'
    }));

    const emceesResult = await session.run('MATCH (e:Emcee) RETURN e.id AS id, e.stage_name AS name ORDER BY e.stage_name ASC');
    emcees = emceesResult.records.map(r => ({ id: r.get('id'), stage_name: r.get('name') }));

    const battlesResult = await session.run('MATCH (b:Battle) RETURN b.id AS id, b.name AS name ORDER BY b.name ASC');
    battles = battlesResult.records.map(r => ({ id: r.get('id'), name: r.get('name') }));

  } catch (error) {
    console.error('Error fetching from Neo4j:', error);
  } finally {
    await session.close();
  }

  return (
    <div className="w-full">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-[#FFFFFF] tracking-tight mb-2">Results</h1>
        <p className="text-[#A3A3A3] text-sm">
          Manage direct Emcee-to-Emcee relationships and battle outcomes.
        </p>
      </div>

      <ParticipantsClientPage 
        initialRelationships={relationships} 
        availableEmcees={emcees}
        availableBattles={battles}
        syncAction={syncBattleRelationships} 
        updateAction={updateRelationshipOutcome} 
        createAction={createRelationship}
        deleteAction={deleteRelationship}
      />
    </div>
  );
}
