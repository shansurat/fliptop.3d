'use client'

import { useState, useMemo } from 'react';

type Emcee = {
  id: string;
  stage_name?: string;
  hometown?: string;
  total_views?: number;
  [key: string]: unknown;
};

interface Props {
  initialEmcees: Emcee[];
  syncAction: () => Promise<{ success: boolean; count?: number; error?: string }>;
  updateAction: (id: string, stage_name: string, hometown: string) => Promise<{ success: boolean; error?: string }>;
  createAction: (stage_name: string, hometown: string) => Promise<{ success: boolean; id?: string; error?: string }>;
  deleteAction: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export default function Neo4jClientPage({ initialEmcees, syncAction, updateAction, createAction, deleteAction }: Props) {
  const [emcees, setEmcees] = useState<Emcee[]>(initialEmcees);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ stage_name: '', hometown: '' });
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ stage_name: '', hometown: '' });

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const [prevInitial, setPrevInitial] = useState(initialEmcees);

  if (initialEmcees !== prevInitial) {
    setPrevInitial(initialEmcees);
    setEmcees(initialEmcees);
  }

  const handleSync = async () => {
    setIsSyncing(true);
    setMessage(null);
    try {
      const result = await syncAction();
      if (result.success) {
        setMessage({ text: `Successfully synced ${result.count} records from Supabase. Refresh to see latest data if needed.`, type: 'success' });
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

  const handleEditClick = (emcee: Emcee) => {
    setEditingId(emcee.id);
    setEditForm({
      stage_name: emcee.stage_name || '',
      hometown: emcee.hometown || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setMessage(null);

    try {
      const result = await updateAction(editingId, editForm.stage_name, editForm.hometown);
      if (result.success) {
        setMessage({ text: 'Successfully updated record in Neo4j.', type: 'success' });
        setEmcees(emcees.map(e => e.id === editingId ? { ...e, ...editForm } : e));
        setEditingId(null);
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
    setMessage(null);
    try {
      const result = await createAction(createForm.stage_name, createForm.hometown);
      if (result.success && result.id) {
        setMessage({ text: 'Successfully created record in Neo4j.', type: 'success' });
        setEmcees([{ id: result.id, stage_name: createForm.stage_name, hometown: createForm.hometown }, ...emcees]);
        setIsCreating(false);
        setCreateForm({ stage_name: '', hometown: '' });
      } else {
        setMessage({ text: `Create failed: ${result.error}`, type: 'error' });
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ text: 'An unexpected error occurred during creation.', type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    setMessage(null);
    try {
      const result = await deleteAction(id);
      if (result.success) {
        setMessage({ text: 'Successfully deleted record from Neo4j.', type: 'success' });
        setEmcees(emcees.filter(e => e.id !== id));
      } else {
        setMessage({ text: `Delete failed: ${result.error}`, type: 'error' });
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ text: 'An unexpected error occurred during deletion.', type: 'error' });
    }
  };

  const filteredEmcees = useMemo(() => {
    let result = [...emcees];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        Object.values(e).some(val => String(val || '').toLowerCase().includes(q))
      );
    }

    if (sortConfig) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

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
  }, [emcees, searchQuery, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const totalPages = Math.ceil(filteredEmcees.length / pageSize);
  const paginatedEmcees = filteredEmcees.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
        <div className="flex gap-3">
          <button
            onClick={() => setIsCreating(true)}
            className="bg-white/[0.07] hover:bg-white/[0.12] text-[#EFEFEF] border border-white/10 rounded px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer"
          >
            Add New Emcee
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
          <div className="bg-[#121212]/80 backdrop-blur-md border border-white/5 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xs font-bold text-[#EFEFEF] tracking-widest uppercase mb-4">Add New Emcee</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] text-[#888] uppercase tracking-widest font-semibold mb-1.5">Stage Name</label>
                <input
                  type="text"
                  required
                  value={createForm.stage_name}
                  onChange={(e) => setCreateForm({ ...createForm, stage_name: e.target.value })}
                  className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all placeholder-[#444]"
                  placeholder="e.g. Loonie"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#888] uppercase tracking-widest font-semibold mb-1.5">Hometown</label>
                <input
                  type="text"
                  value={createForm.hometown}
                  onChange={(e) => setCreateForm({ ...createForm, hometown: e.target.value })}
                  className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-3 py-2 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all placeholder-[#444]"
                  placeholder="e.g. Cebu City"
                />
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

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search all columns..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1); // Reset to first page on search
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
              <th className="py-2 px-3 font-normal cursor-pointer hover:text-white select-none transition-colors" onClick={() => requestSort('stage_name')}>
                Stage Name {sortConfig?.key === 'stage_name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="py-2 px-3 font-normal cursor-pointer hover:text-white select-none transition-colors" onClick={() => requestSort('hometown')}>
                Hometown {sortConfig?.key === 'hometown' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="py-2 px-3 font-normal cursor-pointer hover:text-white select-none transition-colors" onClick={() => requestSort('total_views')}>
                Total Views {sortConfig?.key === 'total_views' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="py-2 px-3 font-normal">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {emcees.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[#707070] text-xs">
                  No records found in Neo4j. Try syncing from Supabase.
                </td>
              </tr>
            ) : (
              paginatedEmcees.map((emcee) => (
                <tr key={emcee.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="py-2.5 px-3 text-xs text-[#cfcfcf]">
                    {editingId === emcee.id ? (
                      <input
                        type="text"
                        value={editForm.stage_name}
                        onChange={(e) => setEditForm({ ...editForm, stage_name: e.target.value })}
                        className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-2 py-1 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all"
                      />
                    ) : (
                      <span className="text-[#EFEFEF] font-medium">{emcee.stage_name || '-'}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-[#cfcfcf]">
                    {editingId === emcee.id ? (
                      <input
                        type="text"
                        value={editForm.hometown}
                        onChange={(e) => setEditForm({ ...editForm, hometown: e.target.value })}
                        className="w-full bg-[#121212]/40 border border-white/5 text-[#A3A3A3] rounded px-2 py-1 text-xs focus:text-[#EFEFEF] focus:border-white/20 focus:bg-white/[0.04] focus:outline-none transition-all"
                      />
                    ) : (
                      <span className="text-[#A3A3A3]">{emcee.hometown || '-'}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-[#cfcfcf]">
                    <span className="text-[#A3A3A3] font-mono">{emcee.total_views ? emcee.total_views.toLocaleString() : '-'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-xs">
                    {editingId === emcee.id ? (
                      <div className="flex gap-3">
                        <button onClick={handleSaveEdit} className="text-xs text-[#EFEFEF] hover:text-white uppercase tracking-wider transition-colors cursor-pointer">Save</button>
                        <button onClick={handleCancelEdit} className="text-xs text-[#888] hover:text-[#A3A3A3] uppercase tracking-wider transition-colors cursor-pointer">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button onClick={() => handleEditClick(emcee)} className="text-xs text-[#888] hover:text-[#EFEFEF] opacity-0 group-hover:opacity-100 uppercase tracking-wider transition-all cursor-pointer">Edit</button>
                        <button onClick={() => handleDelete(emcee.id)} className="text-xs text-red-400/70 hover:text-red-400 opacity-0 group-hover:opacity-100 uppercase tracking-wider transition-all cursor-pointer">Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-[#888] text-xs select-none">
          <div>
            Showing {filteredEmcees.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredEmcees.length)} of {filteredEmcees.length} records
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
