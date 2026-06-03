'use client'

import { useState, useMemo } from 'react';

type Relationship = {
  e1_id: string;
  e1_name: string;
  e2_id: string;
  e2_name: string;
  battle_id: string;
  outcome: 'DEFEATED' | 'BATTLED';
};

interface Props {
  initialRelationships: Relationship[];
  availableEmcees?: { id: string; stage_name: string }[];
  availableBattles?: { id: string; name: string }[];
  syncAction: () => Promise<{ success: boolean; count?: number; error?: string }>;
  updateAction: (e1_id: string, e2_id: string, battle_id: string, newOutcome: 'e1_won' | 'e2_won' | 'draw') => Promise<{ success: boolean; error?: string }>;
  createAction?: (e1_id: string, e2_id: string, battle_id: string, outcome: 'e1_won' | 'e2_won' | 'draw') => Promise<{ success: boolean; error?: string }>;
  deleteAction?: (e1_id: string, e2_id: string, battle_id: string) => Promise<{ success: boolean; error?: string }>;
}

export default function ParticipantsClientPage({ initialRelationships, availableEmcees = [], availableBattles = [], syncAction, updateAction, createAction, deleteAction }: Props) {
  const [relationships, setRelationships] = useState<Relationship[]>(initialRelationships);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editFormOutcome, setEditFormOutcome] = useState<'e1_won' | 'e2_won' | 'draw'>('draw');
  
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<{e1_id: string, e2_id: string, battle_id: string, outcome: 'e1_won' | 'e2_won' | 'draw'}>({ e1_id: '', e2_id: '', battle_id: '', outcome: 'draw' });
  
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const [prevInitial, setPrevInitial] = useState(initialRelationships);

  if (initialRelationships !== prevInitial) {
    setPrevInitial(initialRelationships);
    setRelationships(initialRelationships);
  }

  const handleSync = async () => {
    setIsSyncing(true);
    setMessage(null);
    try {
      const result = await syncAction();
      if (result.success) {
        setMessage({ text: `Successfully synced ${result.count} relationships from Supabase.`, type: 'success' });
        setCurrentPage(1);
      } else {
        setMessage({ text: `Sync failed: ${result.error}`, type: 'error' });
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ text: 'An unexpected error occurred during sync.', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const getEdgeKey = (rel: Relationship) => `${rel.battle_id}-${rel.e1_id}-${rel.e2_id}`;

  const handleEditClick = (rel: Relationship) => {
    setEditingKey(getEdgeKey(rel));
    setEditFormOutcome(rel.outcome === 'DEFEATED' ? 'e1_won' : 'draw');
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
  };

  const handleSaveEdit = async (rel: Relationship) => {
    setMessage(null);
    try {
      const result = await updateAction(rel.e1_id, rel.e2_id, rel.battle_id, editFormOutcome);
      if (result.success) {
        setMessage({ text: 'Successfully updated relationship in Neo4j.', type: 'success' });
        
        setRelationships(relationships.map(r => {
          if (getEdgeKey(r) === getEdgeKey(rel)) {
            if (editFormOutcome === 'e1_won') return { ...r, outcome: 'DEFEATED' };
            if (editFormOutcome === 'e2_won') return { ...r, outcome: 'DEFEATED', e1_id: r.e2_id, e1_name: r.e2_name, e2_id: r.e1_id, e2_name: r.e1_name };
            return { ...r, outcome: 'BATTLED' };
          }
          return r;
        }));
        setEditingKey(null);
      } else {
        setMessage({ text: `Update failed: ${result.error}`, type: 'error' });
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ text: 'An unexpected error occurred during update.', type: 'error' });
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createAction) return;
    if (!createForm.e1_id || !createForm.e2_id || !createForm.battle_id) {
      setMessage({ text: 'Please select both emcees and a battle.', type: 'error' });
      return;
    }
    if (createForm.e1_id === createForm.e2_id) {
      setMessage({ text: 'Emcees must be different.', type: 'error' });
      return;
    }

    setMessage(null);
    try {
      const result = await createAction(createForm.e1_id, createForm.e2_id, createForm.battle_id, createForm.outcome);
      if (result.success) {
        setMessage({ text: 'Successfully created relationship in Neo4j.', type: 'success' });
        
        const e1_name = availableEmcees.find(e => e.id === createForm.e1_id)?.stage_name || 'Unknown';
        const e2_name = availableEmcees.find(e => e.id === createForm.e2_id)?.stage_name || 'Unknown';
        
        const newRel: Relationship = {
          e1_id: createForm.outcome === 'e2_won' ? createForm.e2_id : createForm.e1_id,
          e1_name: createForm.outcome === 'e2_won' ? e2_name : e1_name,
          e2_id: createForm.outcome === 'e2_won' ? createForm.e1_id : createForm.e2_id,
          e2_name: createForm.outcome === 'e2_won' ? e1_name : e2_name,
          battle_id: createForm.battle_id,
          outcome: createForm.outcome === 'draw' ? 'BATTLED' : 'DEFEATED'
        };

        setRelationships([newRel, ...relationships]);
        setIsCreating(false);
        setCreateForm({ e1_id: '', e2_id: '', battle_id: '', outcome: 'draw' });
      } else {
        setMessage({ text: `Create failed: ${result.error}`, type: 'error' });
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ text: 'An unexpected error occurred during creation.', type: 'error' });
    }
  };

  const handleDelete = async (rel: Relationship) => {
    if (!deleteAction) return;
    if (!confirm('Are you sure you want to delete this relationship?')) return;
    setMessage(null);
    try {
      const result = await deleteAction(rel.e1_id, rel.e2_id, rel.battle_id);
      if (result.success) {
        setMessage({ text: 'Successfully deleted relationship.', type: 'success' });
        setRelationships(relationships.filter(r => getEdgeKey(r) !== getEdgeKey(rel)));
      } else {
        setMessage({ text: `Delete failed: ${result.error}`, type: 'error' });
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ text: 'An unexpected error occurred during deletion.', type: 'error' });
    }
  };

  const filteredRelationships = useMemo(() => {
    let result = [...relationships];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => 
        Object.values(e).some(val => String(val || '').toLowerCase().includes(q))
      );
    }
    
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = String(a[sortConfig.key as keyof Relationship] || '');
        const bVal = String(b[sortConfig.key as keyof Relationship] || '');
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [relationships, searchQuery, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const totalPages = Math.ceil(filteredRelationships.length / pageSize);
  const paginatedRelationships = filteredRelationships.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-8 border-b border-[#2f2f2f] pb-4">
        <h2 className="text-xl font-semibold text-[#cfcfcf]">Results</h2>
        <div className="flex gap-3">
          {createAction && (
            <button
              onClick={() => setIsCreating(true)}
              className="bg-[#5E87C9] hover:bg-[#4A72B3] text-white text-sm py-1.5 px-4 rounded transition-colors font-medium shadow-sm"
            >
              Add Opponent Link
            </button>
          )}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="bg-transparent hover:bg-[#2f2f2f] border border-[#2f2f2f] text-[#cfcfcf] text-sm py-1.5 px-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSyncing ? (
               <>
                 <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-[#cfcfcf] inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
                 Syncing...
               </>
            ) : 'Sync from Supabase'}
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#191919] border border-[#2f2f2f] rounded-lg p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">Add Opponent Relationship</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-[#A3A3A3] mb-1">Battle</label>
                <select
                  required
                  value={createForm.battle_id}
                  onChange={(e) => setCreateForm({ ...createForm, battle_id: e.target.value })}
                  className="w-full bg-[#202020] border border-[#2f2f2f] text-[#cfcfcf] rounded px-3 py-2 text-sm focus:border-[#5E87C9] focus:outline-none transition-colors"
                >
                  <option value="">Select a battle...</option>
                  {availableBattles.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#A3A3A3] mb-1">Emcee 1</label>
                <select
                  required
                  value={createForm.e1_id}
                  onChange={(e) => setCreateForm({ ...createForm, e1_id: e.target.value })}
                  className="w-full bg-[#202020] border border-[#2f2f2f] text-[#cfcfcf] rounded px-3 py-2 text-sm focus:border-[#5E87C9] focus:outline-none transition-colors"
                >
                  <option value="">Select emcee 1...</option>
                  {availableEmcees.map(e => (
                    <option key={e.id} value={e.id}>{e.stage_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#A3A3A3] mb-1">Emcee 2</label>
                <select
                  required
                  value={createForm.e2_id}
                  onChange={(e) => setCreateForm({ ...createForm, e2_id: e.target.value })}
                  className="w-full bg-[#202020] border border-[#2f2f2f] text-[#cfcfcf] rounded px-3 py-2 text-sm focus:border-[#5E87C9] focus:outline-none transition-colors"
                >
                  <option value="">Select emcee 2...</option>
                  {availableEmcees.map(e => (
                    <option key={e.id} value={e.id}>{e.stage_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#A3A3A3] mb-1">Outcome</label>
                <select
                  value={createForm.outcome}
                  onChange={(e) => setCreateForm({ ...createForm, outcome: e.target.value as any })}
                  className="w-full bg-[#202020] border border-[#2f2f2f] text-[#cfcfcf] rounded px-3 py-2 text-sm focus:border-[#5E87C9] focus:outline-none transition-colors"
                >
                  <option value="e1_won">Emcee 1 Won</option>
                  <option value="e2_won">Emcee 2 Won</option>
                  <option value="draw">Draw (Battled)</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-sm text-[#A3A3A3] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#5E87C9] hover:bg-[#4A72B3] text-white text-sm rounded transition-colors font-medium"
                >
                  Create
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
            setCurrentPage(1); // Reset to first page on search
          }}
          className="w-full max-w-md bg-[#191919] border border-[#2f2f2f] text-[#cfcfcf] rounded px-3 py-2 text-sm focus:border-[#5E87C9] focus:outline-none transition-colors"
        />
      </div>

      {message && (
        <div className={`p-3 mb-6 rounded text-sm ${message.type === 'success' ? 'bg-[#2F2F2F] text-[#cfcfcf] border border-[#373737]' : 'bg-[#3b2a2a] text-[#eb5757] border border-[#4d3636]'}`}>
          {message.text}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[#707070] text-sm border-b border-[#2f2f2f]">
              <th className="py-2 px-3 font-normal cursor-pointer hover:text-white select-none transition-colors" onClick={() => requestSort('battle_id')}>
                Battle {sortConfig?.key === 'battle_id' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="py-2 px-3 font-normal text-right cursor-pointer hover:text-white select-none transition-colors" onClick={() => requestSort('e1_name')}>
                Emcee 1 {sortConfig?.key === 'e1_name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="py-2 px-3 font-normal text-center cursor-pointer hover:text-white select-none transition-colors" onClick={() => requestSort('outcome')}>
                Outcome {sortConfig?.key === 'outcome' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="py-2 px-3 font-normal cursor-pointer hover:text-white select-none transition-colors" onClick={() => requestSort('e2_name')}>
                Emcee 2 {sortConfig?.key === 'e2_name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="py-2 px-3 font-normal">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2f2f2f]">
            {relationships.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#707070] text-sm">
                  No relationships found in Neo4j. Try syncing from Supabase.
                </td>
              </tr>
            ) : (
              paginatedRelationships.map((rel) => {
                const isEditing = editingKey === getEdgeKey(rel);
                const battleName = availableBattles.find(b => b.id === rel.battle_id)?.name || 'Unknown Battle';
                
                return (
                  <tr key={getEdgeKey(rel)} className="hover:bg-[#202020] transition-colors group">
                    <td className="py-2.5 px-3 text-[#cfcfcf] text-sm">{battleName}</td>
                    <td className="py-2.5 px-3 text-sm text-[#cfcfcf] font-medium text-right">{rel.e1_name || 'Unknown'}</td>
                    <td className="py-2.5 px-3 text-sm text-center">
                      {isEditing ? (
                        <select
                          value={editFormOutcome}
                          onChange={(e) => setEditFormOutcome(e.target.value as 'e1_won' | 'e2_won' | 'draw')}
                          className="bg-[#191919] border border-[#2f2f2f] text-[#cfcfcf] rounded px-2 py-1 text-sm focus:border-[#5E87C9] focus:outline-none"
                        >
                          <option value="e1_won">Defeated (Left Won)</option>
                          <option value="e2_won">Defeated By (Right Won)</option>
                          <option value="draw">Battled (Draw)</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-xs tracking-wider ${rel.outcome === 'DEFEATED' ? 'bg-[#2a3f2a] text-[#71cf71]' : 'bg-[#2f2f2f] text-[#A3A3A3]'}`}>
                          {rel.outcome}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-[#cfcfcf] font-medium">{rel.e2_name || 'Unknown'}</td>
                    <td className="py-2.5 px-3 text-sm">
                      {isEditing ? (
                        <div className="flex gap-3">
                          <button onClick={() => handleSaveEdit(rel)} className="text-[#cfcfcf] hover:text-white transition-colors">Save</button>
                          <button onClick={handleCancelEdit} className="text-[#707070] hover:text-[#A3A3A3] transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button onClick={() => handleEditClick(rel)} className="text-[#707070] hover:text-[#cfcfcf] opacity-0 group-hover:opacity-100 transition-all">Edit Outcome</button>
                          {deleteAction && (
                            <button onClick={() => handleDelete(rel)} className="text-[#eb5757] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">Delete</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-[#707070] text-sm">
          <div>
            Showing {filteredRelationships.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredRelationships.length)} of {filteredRelationships.length} records
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded hover:bg-[#2f2f2f] disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded hover:bg-[#2f2f2f] disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
