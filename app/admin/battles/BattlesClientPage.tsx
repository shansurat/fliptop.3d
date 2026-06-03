'use client'

import { useState, useMemo } from 'react';

type Battle = {
  id: string;
  name?: string;
  match_type?: string;
  match_format?: string;
  view_count?: number;
  event_id?: string | null;
  event_name?: string | null;
  e1_id?: string | null;
  e1_name?: string | null;
  e2_id?: string | null;
  e2_name?: string | null;
  outcome?: 'DEFEATED' | 'BATTLED' | null;
  [key: string]: unknown;
};

interface Props {
  initialBattles: Battle[];
  availableEvents?: { id: string; name: string }[];
  availableEmcees?: { id: string; stage_name: string }[];
  syncAction: () => Promise<{ success: boolean; count?: number; error?: string }>;
  syncRelationshipsAction: () => Promise<{ success: boolean; count?: number; error?: string }>;
  saveAction: (
    id: string,
    name: string,
    match_type: string,
    match_format: string,
    event_id: string | null,
    e1_id: string | null,
    e2_id: string | null,
    outcome: 'e1_won' | 'e2_won' | 'draw' | null
  ) => Promise<{ success: boolean; error?: string }>;
  deleteAction?: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const uuidv4 = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function BattlesClientPage({
  initialBattles,
  availableEvents = [],
  availableEmcees = [],
  syncAction,
  syncRelationshipsAction,
  saveAction,
  deleteAction
}: Props) {
  const [battles, setBattles] = useState<Battle[]>(initialBattles);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingBattle, setEditingBattle] = useState<Battle | null>(null);

  const [editForm, setEditForm] = useState({
    name: '',
    match_type: 'tournament',
    match_format: '1v1',
    event_id: '',
    e1_id: '',
    e2_id: '',
    outcome: '' as 'e1_won' | 'e2_won' | 'draw' | ''
  });

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    match_type: 'tournament',
    match_format: '1v1',
    event_id: '',
    e1_id: '',
    e2_id: '',
    outcome: 'draw' as 'e1_won' | 'e2_won' | 'draw'
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const [prevInitial, setPrevInitial] = useState(initialBattles);

  if (initialBattles !== prevInitial) {
    setPrevInitial(initialBattles);
    setBattles(initialBattles);
  }

  const handleSync = async () => {
    setIsSyncing(true);
    setMessage(null);
    try {
      setMessage({ text: 'Syncing battles from Supabase...', type: 'success' });
      const battlesResult = await syncAction();
      if (!battlesResult.success) {
        setMessage({ text: `Battles sync failed: ${battlesResult.error}`, type: 'error' });
        return;
      }

      setMessage({ text: `Battles synced (${battlesResult.count} records). Syncing matchup results...`, type: 'success' });
      const relationshipsResult = await syncRelationshipsAction();

      if (relationshipsResult.success) {
        setMessage({
          text: `Successfully synced ${battlesResult.count} battles and ${relationshipsResult.count} matchup results from Supabase. Please refresh the page to view the latest data in the table.`,
          type: 'success'
        });
        setCurrentPage(1);
      } else {
        setMessage({ text: `Matchup results sync failed: ${relationshipsResult.error}`, type: 'error' });
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ text: 'An unexpected error occurred during sync.', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEditClick = (battle: Battle) => {
    setEditingBattle(battle);

    let initialOutcome: 'e1_won' | 'e2_won' | 'draw' | '' = '';
    if (battle.outcome === 'DEFEATED') {
      initialOutcome = 'e1_won';
    } else if (battle.outcome === 'BATTLED') {
      initialOutcome = 'draw';
    }

    setEditForm({
      name: battle.name || '',
      match_type: battle.match_type || 'tournament',
      match_format: battle.match_format || '1v1',
      event_id: battle.event_id || '',
      e1_id: battle.e1_id || '',
      e2_id: battle.e2_id || '',
      outcome: initialOutcome
    });
  };

  const handleSaveEdit = async () => {
    if (!editingBattle) return;
    setMessage(null);

    if (editForm.e1_id && editForm.e1_id === editForm.e2_id) {
      setMessage({ text: 'Challenger 1 and Challenger 2 must be different Emcees.', type: 'error' });
      return;
    }

    try {
      const eId = editForm.event_id || null;
      const e1Id = editForm.e1_id || null;
      const e2Id = editForm.e2_id || null;
      const outcomeVal = (e1Id && e2Id) ? (editForm.outcome as 'e1_won' | 'e2_won' | 'draw' || 'draw') : null;

      const result = await saveAction(
        editingBattle.id,
        editForm.name,
        editForm.match_type,
        editForm.match_format,
        eId,
        e1Id,
        e2Id,
        outcomeVal
      );

      if (result.success) {
        setMessage({ text: 'Successfully saved Battle and Result in Neo4j.', type: 'success' });

        const e1Name = availableEmcees.find(e => e.id === e1Id)?.stage_name || null;
        const e2Name = availableEmcees.find(e => e.id === e2Id)?.stage_name || null;
        const eventName = availableEvents.find(e => e.id === eId)?.name || null;

        setBattles(battles.map(b => b.id === editingBattle.id ? {
          ...b,
          name: editForm.name,
          match_type: editForm.match_type,
          match_format: editForm.match_format,
          event_id: eId,
          event_name: eventName,
          e1_id: e1Id,
          e1_name: e1Name,
          e2_id: e2Id,
          e2_name: e2Name,
          outcome: outcomeVal ? (outcomeVal === 'draw' ? 'BATTLED' : 'DEFEATED') : null
        } : b));
        setEditingBattle(null);
      } else {
        setMessage({ text: `Save failed: ${result.error}`, type: 'error' });
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ text: 'An unexpected error occurred during save.', type: 'error' });
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (createForm.e1_id && createForm.e1_id === createForm.e2_id) {
      setMessage({ text: 'Challenger 1 and Challenger 2 must be different Emcees.', type: 'error' });
      return;
    }

    try {
      const newId = uuidv4();
      const eId = createForm.event_id || null;
      const e1Id = createForm.e1_id || null;
      const e2Id = createForm.e2_id || null;
      const outcomeVal = (e1Id && e2Id) ? (createForm.outcome as 'e1_won' | 'e2_won' | 'draw' || 'draw') : null;

      const result = await saveAction(
        newId,
        createForm.name,
        createForm.match_type,
        createForm.match_format,
        eId,
        e1Id,
        e2Id,
        outcomeVal
      );

      if (result.success) {
        setMessage({ text: 'Successfully created battle record in Neo4j.', type: 'success' });
        const e1Name = availableEmcees.find(e => e.id === e1Id)?.stage_name || null;
        const e2Name = availableEmcees.find(e => e.id === e2Id)?.stage_name || null;
        const eventName = availableEvents.find(e => e.id === eId)?.name || null;

        setBattles([
          {
            id: newId,
            name: createForm.name,
            match_type: createForm.match_type,
            match_format: createForm.match_format,
            event_id: eId,
            event_name: eventName,
            e1_id: e1Id,
            e1_name: e1Name,
            e2_id: e2Id,
            e2_name: e2Name,
            outcome: outcomeVal ? (outcomeVal === 'draw' ? 'BATTLED' : 'DEFEATED') : null
          },
          ...battles
        ]);
        setIsCreating(false);
        setCreateForm({
          name: '',
          match_type: 'tournament',
          match_format: '1v1',
          event_id: '',
          e1_id: '',
          e2_id: '',
          outcome: 'draw'
        });
      } else {
        setMessage({ text: `Create failed: ${result.error}`, type: 'error' });
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ text: 'An unexpected error occurred during creation.', type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!deleteAction) return;
    if (!confirm('Are you sure you want to delete this record?')) return;
    setMessage(null);
    try {
      const result = await deleteAction(id);
      if (result.success) {
        setMessage({ text: 'Successfully deleted record from Neo4j.', type: 'success' });
        setBattles(battles.filter(b => b.id !== id));
      } else {
        setMessage({ text: `Delete failed: ${result.error}`, type: 'error' });
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ text: 'An unexpected error occurred during deletion.', type: 'error' });
    }
  };

  const filteredBattles = useMemo(() => {
    let result = [...battles];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        Object.values(e).some(val => String(val || '').toLowerCase().includes(q))
      );
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (['total_views', 'view_count', 'year'].includes(sortConfig.key)) {
          const numA = Number(aVal) || 0;
          const numB = Number(bVal) || 0;
          return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        }

        const aStr = String(aVal || '').toLowerCase();
        const bStr = String(bVal || '').toLowerCase();

        if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [battles, searchQuery, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const totalPages = Math.ceil(filteredBattles.length / pageSize);
  const paginatedBattles = filteredBattles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
        {/* <h2 className="text-lg font-bold text-[#EFEFEF] tracking-widest uppercase">Battles</h2> */}
        <div className="flex gap-3">
          <button
            onClick={() => setIsCreating(true)}
            className="bg-white/[0.07] hover:bg-white/[0.12] text-[#EFEFEF] border border-white/10 rounded px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer"
          >
            Add New Battle
          </button>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="bg-transparent hover:bg-white/[0.04] border border-white/5 text-[#A3A3A3] hover:text-[#EFEFEF] text-xs py-1.5 px-3 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          >
            {isSyncing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-[#cfcfcf]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Syncing...
              </>
            ) : (
              'Sync from Supabase'
            )}
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212]/80 backdrop-blur-md border border-white/5 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xs font-bold text-[#EFEFEF] tracking-widest uppercase mb-4">Add New Battle</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] text-[#888] uppercase tracking-widest font-semibold mb-1.5">Battle Name</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all placeholder-[#444]"
                  placeholder="e.g. Loonie vs Abra"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-[#888] uppercase tracking-widest font-semibold mb-1.5">Match Type</label>
                  <select
                    value={createForm.match_type}
                    onChange={(e) => setCreateForm({ ...createForm, match_type: e.target.value })}
                    className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="tournament">Tournament</option>
                    <option value="promo">Promo</option>
                    <option value="tryouts">Tryouts</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[#888] uppercase tracking-widest font-semibold mb-1.5">Matchup Format</label>
                  <select
                    value={createForm.match_format}
                    onChange={(e) => setCreateForm({ ...createForm, match_format: e.target.value })}
                    className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="1v1">1v1</option>
                    <option value="2v2">2v2</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-[#888] uppercase tracking-widest font-semibold mb-1.5">Event (Optional)</label>
                <select
                  value={createForm.event_id}
                  onChange={(e) => setCreateForm({ ...createForm, event_id: e.target.value })}
                  className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all cursor-pointer"
                >
                  <option value="">No Event</option>
                  {availableEvents.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              </div>

              <div className="border-t border-white/5 pt-4 my-2">
                <h4 className="text-[10px] font-bold text-[#EFEFEF] tracking-widest uppercase mb-3">Matchup & Winner</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] text-[#888] uppercase tracking-widest font-semibold mb-1.5">Challenger 1</label>
                    <select
                      value={createForm.e1_id}
                      onChange={(e) => setCreateForm({ ...createForm, e1_id: e.target.value })}
                      className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="">Select Emcee</option>
                      {availableEmcees.map(em => (
                        <option key={em.id} value={em.id}>{em.stage_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] text-[#888] uppercase tracking-widest font-semibold mb-1.5">Challenger 2</label>
                    <select
                      value={createForm.e2_id}
                      onChange={(e) => setCreateForm({ ...createForm, e2_id: e.target.value })}
                      className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="">Select Emcee</option>
                      {availableEmcees.map(em => (
                        <option key={em.id} value={em.id}>{em.stage_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {createForm.e1_id && createForm.e2_id && (
                  <div className="mt-3">
                    <label className="block text-[9px] text-[#888] uppercase tracking-widest font-semibold mb-1.5">Battle Winner</label>
                    <select
                      value={createForm.outcome}
                      onChange={(e) => setCreateForm({ ...createForm, outcome: e.target.value as any })}
                      className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="draw">Draw / Undecided</option>
                      <option value="e1_won">Challenger 1 Won</option>
                      <option value="e2_won">Challenger 2 Won</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-xs text-[#888] hover:text-[#EFEFEF] uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-white/[0.07] hover:bg-white/[0.12] text-[#EFEFEF] border border-white/10 text-xs rounded transition-all uppercase tracking-wider font-semibold cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingBattle && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212]/80 backdrop-blur-md border border-white/5 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xs font-bold text-[#EFEFEF] tracking-widest uppercase mb-4">Edit Battle</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEdit();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] text-[#888] uppercase tracking-widest font-semibold mb-1.5">Battle Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-[#888] uppercase tracking-widest font-semibold mb-1.5">Match Type</label>
                  <select
                    value={editForm.match_type}
                    onChange={(e) => setEditForm({ ...editForm, match_type: e.target.value })}
                    className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="tournament">Tournament</option>
                    <option value="promo">Promo</option>
                    <option value="tryouts">Tryouts</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[#888] uppercase tracking-widest font-semibold mb-1.5">Matchup Format</label>
                  <select
                    value={editForm.match_format}
                    onChange={(e) => setEditForm({ ...editForm, match_format: e.target.value })}
                    className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="1v1">1v1</option>
                    <option value="2v2">2v2</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-[#888] uppercase tracking-widest font-semibold mb-1.5">Event (Optional)</label>
                <select
                  value={editForm.event_id}
                  onChange={(e) => setEditForm({ ...editForm, event_id: e.target.value })}
                  className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all cursor-pointer"
                >
                  <option value="">No Event</option>
                  {availableEvents.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              </div>

              <div className="border-t border-white/5 pt-4 my-2">
                <h4 className="text-[10px] font-bold text-[#EFEFEF] tracking-widest uppercase mb-3">Matchup & Winner</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] text-[#888] uppercase tracking-widest font-semibold mb-1.5">Challenger 1</label>
                    <select
                      value={editForm.e1_id}
                      onChange={(e) => setEditForm({ ...editForm, e1_id: e.target.value })}
                      className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="">Select Emcee</option>
                      {availableEmcees.map(em => (
                        <option key={em.id} value={em.id}>{em.stage_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] text-[#888] uppercase tracking-widest font-semibold mb-1.5">Challenger 2</label>
                    <select
                      value={editForm.e2_id}
                      onChange={(e) => setEditForm({ ...editForm, e2_id: e.target.value })}
                      className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="">Select Emcee</option>
                      {availableEmcees.map(em => (
                        <option key={em.id} value={em.id}>{em.stage_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {editForm.e1_id && editForm.e2_id && (
                  <div className="mt-3">
                    <label className="block text-[9px] text-[#888] uppercase tracking-widest font-semibold mb-1.5">Battle Winner</label>
                    <select
                      value={editForm.outcome}
                      onChange={(e) => setEditForm({ ...editForm, outcome: e.target.value as any })}
                      className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="draw">Draw / Undecided</option>
                      <option value="e1_won">Challenger 1 Won</option>
                      <option value="e2_won">Challenger 2 Won</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingBattle(null)}
                  className="px-4 py-2 text-xs text-[#888] hover:text-[#EFEFEF] uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-white/[0.07] hover:bg-white/[0.12] text-[#EFEFEF] border border-white/10 text-xs rounded transition-all uppercase tracking-wider font-semibold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search all columns..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full max-w-md bg-[#121212]/30 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all"
        />
      </div>

      {message && (
        <div className={`p-3 mb-6 rounded text-xs font-mono border ${message.type === 'success' ? 'bg-[#121212]/20 text-[#A3A3A3] border-white/5' : 'bg-red-950/20 text-red-400/80 border-red-500/10'}`}>
          {message.text}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[#888] text-xs border-b border-white/5">
              <th className="py-2 px-3 font-normal cursor-pointer hover:text-white select-none transition-colors" onClick={() => requestSort('name')}>
                Name {sortConfig?.key === 'name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="py-2 px-3 font-normal cursor-pointer hover:text-white select-none transition-colors" onClick={() => requestSort('match_type')}>
                Battle Type {sortConfig?.key === 'match_type' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="py-2 px-3 font-normal cursor-pointer hover:text-white select-none transition-colors" onClick={() => requestSort('match_format')}>
                Format {sortConfig?.key === 'match_format' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="py-2 px-3 font-normal min-w-[280px] whitespace-nowrap">
                Matchup & Result
              </th>
              <th className="py-2 px-3 font-normal cursor-pointer hover:text-white select-none transition-colors" onClick={() => requestSort('view_count')}>
                Views {sortConfig?.key === 'view_count' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="py-2 px-3 font-normal cursor-pointer hover:text-white select-none transition-colors" onClick={() => requestSort('event_id')}>
                Event {sortConfig?.key === 'event_id' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="py-2 px-3 font-normal">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {filteredBattles.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#707070] text-xs">
                  No records found in Neo4j. Try syncing from Supabase.
                </td>
              </tr>
            ) : (
              paginatedBattles.map((battle) => {
                const eventName = availableEvents.find(e => e.id === battle.event_id)?.name;
                return (
                  <tr key={battle.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="py-2.5 px-3 text-xs text-[#cfcfcf]">
                      <span className="text-[#EFEFEF] font-medium">{battle.name || '-'}</span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-[#cfcfcf]">
                      <span className="text-[#A3A3A3] capitalize">{battle.match_type || '-'}</span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-[#cfcfcf]">
                      <span className="text-[#A3A3A3] capitalize">{battle.match_format || '-'}</span>
                    </td>

                    {/* Matchup & Result column */}
                    <td className="py-2.5 px-3 text-xs">
                      {battle.e1_id && battle.e2_id ? (
                        <div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap">
                          {battle.outcome === 'DEFEATED' ? (
                            <>
                              <span className="text-[#4ade80] bg-emerald-950/20 border border-emerald-500/10 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                {battle.e1_name}
                              </span>
                              <span className="text-[#666] text-[10px]">def.</span>
                              <span className="text-[#a3a3a3] border border-white/5 bg-white/[0.02] px-1.5 py-0.5 rounded text-[10px]">
                                {battle.e2_name}
                              </span>
                            </>
                          ) : battle.outcome === 'BATTLED' ? (
                            <>
                              <span className="text-[#a3a3a3] border border-white/5 bg-white/[0.02] px-1.5 py-0.5 rounded text-[10px]">
                                {battle.e1_name}
                              </span>
                              <span className="text-[#666] px-1 text-[10px]">vs</span>
                              <span className="text-[#a3a3a3] border border-white/5 bg-white/[0.02] px-1.5 py-0.5 rounded text-[10px]">
                                {battle.e2_name}
                              </span>
                              <span className="text-amber-400/80 bg-amber-950/20 border border-amber-500/10 px-1 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold">
                                Draw
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-[#a3a3a3]">{battle.e1_name}</span>
                              <span className="text-[#666]">vs</span>
                              <span className="text-[#a3a3a3]">{battle.e2_name}</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#555] italic">No matchup configured</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-xs text-[#cfcfcf]">
                      <span className="text-[#A3A3A3] font-mono">{battle.view_count ? battle.view_count.toLocaleString() : '-'}</span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-[#cfcfcf]">
                      <span className="text-[#A3A3A3]">{eventName || '-'}</span>
                    </td>
                    <td className="py-2.5 px-3 text-xs">
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleEditClick(battle)}
                          className="text-xs text-[#888] hover:text-[#EFEFEF] opacity-0 group-hover:opacity-100 uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Edit
                        </button>
                        {deleteAction && (
                          <button
                            onClick={() => handleDelete(battle.id)}
                            className="text-xs text-red-400/70 hover:text-red-400 opacity-0 group-hover:opacity-100 uppercase tracking-wider transition-all cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-[#888] text-xs select-none">
          <div>
            Showing {filteredBattles.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredBattles.length)} of {filteredBattles.length} records
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded hover:bg-white/[0.03] disabled:opacity-30 disabled:hover:bg-transparent transition-colors uppercase tracking-wider cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded hover:bg-white/[0.03] disabled:opacity-30 disabled:hover:bg-transparent transition-colors uppercase tracking-wider cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
