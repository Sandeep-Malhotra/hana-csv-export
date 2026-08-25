'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getConnections, getObjects, startExport } from '@/lib/api';
import { Connection, DbObject, ObjectType, ExportObjectInput } from '@/lib/types';

type FilterType = 'ALL' | ObjectType;

interface DatabaseExplorerProps {
  onExportStarted: (jobId: string) => void;
}

export default function DatabaseExplorer({ onExportStarted }: DatabaseExplorerProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [objects, setObjects] = useState<DbObject[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [objectsError, setObjectsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    getConnections()
      .then((data) => {
        setConnections(data);
        if (data.length > 0) setSelectedConnectionId(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingConnections(false));
  }, []);

  const handleConnect = useCallback(async () => {
    if (!selectedConnectionId) return;
    setLoadingObjects(true);
    setObjectsError(null);
    setObjects([]);
    setSelected(new Set());
    setSearch('');
    setFilterType('ALL');
    try {
      const data = await getObjects(selectedConnectionId);
      setObjects(data);
    } catch (e: any) {
      setObjectsError(e.message || 'Failed to load objects');
    } finally {
      setLoadingObjects(false);
    }
  }, [selectedConnectionId]);

  const displayedObjects = useMemo(() => {
    let result = objects;
    if (filterType !== 'ALL') result = result.filter((o) => o.type === filterType);
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter((o) =>
        o.name.toLowerCase().includes(lower) ||
        o.hanaTableName.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [objects, filterType, search]);

  const counts = useMemo(() => {
    const c = { TABLE: 0, VIEW: 0, SYNONYM: 0 };
    for (const o of objects) c[o.type] = (c[o.type] || 0) + 1;
    return c;
  }, [objects]);

  const toggleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleStartExport = async () => {
    if (selected.size === 0 || !selectedConnectionId || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const exportObjects: ExportObjectInput[] = Array.from(selected).map((name) => {
        const obj = objects.find((o) => o.name === name);
        return {
          name: obj?.name ?? name,
          hanaTableName: obj?.hanaTableName ?? name,
          csvFileName: obj?.csvFileName ?? `${name}.csv`,
          rowCount: obj?.rowCount,
        };
      });
      const result = await startExport(selectedConnectionId, exportObjects);
      setSelected(new Set());
      onExportStarted(result.jobId);
    } catch (e: any) {
      setExportError(e.message || 'Export failed to start');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Connection selector */}
      <div className="p-3 border-b border-zinc-800 shrink-0">
        {loadingConnections ? (
          <div className="text-zinc-600 text-xs py-1">Loading connections…</div>
        ) : connections.length === 0 ? (
          <div className="text-zinc-600 text-xs py-1">
            No connections — add one in Connections tab.
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              value={selectedConnectionId}
              onChange={(e) => {
                setSelectedConnectionId(e.target.value);
                setObjects([]);
                setSelected(new Set());
                setObjectsError(null);
              }}
              className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleConnect}
              disabled={loadingObjects || !selectedConnectionId}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50 shrink-0"
            >
              {loadingObjects ? 'Loading…' : 'Connect'}
            </button>
          </div>
        )}
      </div>

      {/* Search + type filter — shown once objects are loaded */}
      {objects.length > 0 && (
        <div className="p-2 border-b border-zinc-800 space-y-1.5 shrink-0">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name (contains)…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 pr-6 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 text-xs leading-none"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          {search.trim() && (
            <p className="text-xs text-zinc-600 px-0.5">
              {displayedObjects.length === 0
                ? 'No matches'
                : `${displayedObjects.length} of ${objects.length} match "${search.trim()}"`}
            </p>
          )}
          <div className="flex gap-1 flex-wrap">
            {(['ALL', 'TABLE', 'VIEW', 'SYNONYM'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  filterType === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
                }`}
              >
                {t === 'ALL'
                  ? `All (${objects.length})`
                  : t === 'TABLE'
                  ? `Tables (${counts.TABLE})`
                  : t === 'VIEW'
                  ? `Views (${counts.VIEW})`
                  : `Synonyms (${counts.SYNONYM})`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error banner */}
      {objectsError && (
        <div className="px-3 py-2 text-xs text-red-400 bg-red-950/40 border-b border-red-900/40 shrink-0">
          {objectsError}
        </div>
      )}

      {/* Object list — grows to fill all available height */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loadingObjects && (
          <div className="flex items-center justify-center h-24 text-zinc-600 text-xs">
            Loading objects…
          </div>
        )}

        {!loadingObjects && objects.length === 0 && !objectsError && (
          <div className="flex items-center justify-center h-full text-center px-4">
            <p className="text-xs text-zinc-600">
              Select a connection and click <strong className="text-zinc-500">Connect</strong>.
            </p>
          </div>
        )}

        {!loadingObjects && objects.length > 0 && displayedObjects.length === 0 && (
          <div className="p-4 text-xs text-center text-zinc-600">No objects match</div>
        )}

        {displayedObjects.length > 0 && (
          <>
            {/* Sticky select-all bar */}
            <div className="sticky top-0 z-10 flex items-center gap-3 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800/60 text-xs">
              <button
                onClick={() => setSelected(new Set(displayedObjects.map((o) => o.name)))}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                All
              </button>
              <span className="text-zinc-700">·</span>
              <button
                onClick={() => setSelected(new Set())}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                None
              </button>
              {selected.size > 0 && (
                <span className="ml-auto text-blue-400 font-medium">
                  {selected.size} selected
                </span>
              )}
            </div>

            <div className="divide-y divide-zinc-800/30">
              {displayedObjects.map((obj) => (
                <label
                  key={obj.name}
                  className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                    selected.has(obj.name)
                      ? 'bg-blue-950/30 hover:bg-blue-950/40'
                      : 'hover:bg-zinc-800/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(obj.name)}
                    onChange={() => toggleSelect(obj.name)}
                    className="w-3.5 h-3.5 accent-blue-500 shrink-0"
                  />
                  <span className="flex-1 text-xs font-mono text-zinc-300 truncate min-w-0">
                    {obj.name}
                  </span>
                  <TypeTag type={obj.type} />
                  {obj.isDraft && (
                    <span className="text-xs px-1 py-0.5 rounded bg-zinc-700 text-zinc-400 shrink-0">
                      draft
                    </span>
                  )}
                  {obj.rowCount !== undefined && (
                    <span className="text-xs text-zinc-600 tabular-nums w-14 text-right shrink-0">
                      {obj.rowCount.toLocaleString()}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sticky export button */}
      {objects.length > 0 && (
        <div className="p-3 border-t border-zinc-800 shrink-0">
          {exportError && (
            <p className="mb-2 text-xs text-red-400">{exportError}</p>
          )}
          <button
            onClick={handleStartExport}
            disabled={selected.size === 0 || exporting}
            className="w-full py-2 text-xs font-semibold rounded transition-colors disabled:cursor-not-allowed bg-green-700 hover:bg-green-600 text-white disabled:bg-zinc-800 disabled:text-zinc-600"
          >
            {exporting
              ? 'Starting…'
              : selected.size === 0
              ? 'Select objects to export'
              : `Export ${selected.size} object${selected.size !== 1 ? 's' : ''} →`}
          </button>
        </div>
      )}
    </div>
  );
}

function TypeTag({ type }: { type: ObjectType }) {
  const map: Record<ObjectType, { label: string; cls: string }> = {
    TABLE:   { label: 'T', cls: 'text-blue-500' },
    VIEW:    { label: 'V', cls: 'text-purple-400' },
    SYNONYM: { label: 'S', cls: 'text-amber-400' },
  };
  const { label, cls } = map[type];
  return (
    <span className={`text-xs font-mono font-bold shrink-0 ${cls}`} title={type}>
      {label}
    </span>
  );
}
