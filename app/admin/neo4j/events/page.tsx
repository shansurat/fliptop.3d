import { getNeo4jDriver } from '@/lib/neo4j';
import { syncEventsFromSupabase, updateEvent } from '../actions';
import EventsClientPage from './EventsClientPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EventsAdminPage() {
  const driver = getNeo4jDriver();
  const session = driver.session();
  let events: {
    id: string;
    name: string;
    year: number;
    city: string;
    venue_name: string;
    date: string;
  }[] = [];

  try {
    const result = await session.run('MATCH (e:Event) RETURN e ORDER BY e.year DESC, e.date DESC');
    events = result.records.map((record) => {
      const props = record.get('e').properties;
      return {
        id: props.id,
        name: props.name || '',
        year: props.year?.toNumber ? props.year.toNumber() : props.year,
        city: props.city || '',
        venue_name: props.venue_name || '',
        date: props.date || ''
      };
    });
  } catch (error) {
    console.error('Error fetching from Neo4j:', error);
  } finally {
    await session.close();
  }

  return (
    <div className="w-full">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-[#FFFFFF] tracking-tight mb-2">Events</h1>
        <p className="text-[#A3A3A3] text-sm">
          Manage Event graph nodes and synchronize records from Supabase.
        </p>
      </div>

      <EventsClientPage
        initialEvents={events}
        syncAction={syncEventsFromSupabase}
        updateAction={updateEvent}
      />
    </div>
  );
}
