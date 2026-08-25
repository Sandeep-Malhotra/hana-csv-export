'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getJobs, subscribeProgress, downloadFile, downloadZip } from '@/lib/api';
import { ExportJob, ObjectExportState, ExportStatus, ProgressEvent } from '@/lib/types';

interface ExportDashboardProps {
  newJobId?: string;
}

export default function ExportDashboard({ newJobId }: ExportDashboardProps) {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [progressMap, setProgressMap] = useState<Map<string, ProgressEvent>>(new Map());
  const sseCleanups = useRef<Map<string, () => void>>(new Map());

  const loadJobs = useCallback(async () => {
    try {
      const data = await getJobs();
      data.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      setJobs(data);
      return data;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const subscribeToJob = useCallback(
    (jobId: string) => {
      if (sseCleanups.current.has(jobId)) return;
      const cleanup = subscribeProgress(
        jobId,
        (event: ProgressEvent) => {
          setProgressMap((prev) => {
            const next = new Map(prev);
            next.set(jobId, event);
            return next;
          });
          if (event.done) loadJobs();
        },
        () => sseCleanups.current.delete(jobId),
        () => sseCleanups.current.delete(jobId),
      );
      sseCleanups.current.set(jobId, cleanup);
    },
    [loadJobs],
  );

  useEffect(() => {
    loadJobs().then((data) => {
      for (const job of data) {
        const allDone = job.objects.every((o) => o.status === 'done' || o.status === 'failed');
        if (!allDone) subscribeToJob(job.jobId);
      }
    });
    return () => {
      sseCleanups.current.forEach((c) => c());
      sseCleanups.current.clear();
    };
  }, [loadJobs, subscribeToJob]);

  useEffect(() => {
    if (newJobId) {
      loadJobs().then(() => subscribeToJob(newJobId));
    }
  }, [newJobId, loadJobs, subscribeToJob]);

  const liveObjects = (job: ExportJob): ObjectExportState[] =>
    progressMap.get(job.jobId)?.objects ?? job.objects;

  const overallPct = (job: ExportJob): number => {
    const live = progressMap.get(job.jobId);
    if (live) return live.overallPercent;
    const objs = job.objects;
    const done = objs.filter((o) => o.status === 'done' || o.status === 'failed').length;
    return objs.length ? Math.floor((done / objs.length) * 100) : 0;
  };

  const isJobDone = (job: ExportJob): boolean =>
    progressMap.get(job.jobId)?.done ??
    job.objects.every((o) => o.status === 'done' || o.status === 'failed');

  const activeJobs = jobs.filter((j) => !isJobDone(j));
  const completedJobs = jobs.filter((j) => isJobDone(j));

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Export Queue
        </span>
        <button
          onClick={() => loadJobs()}
          className="text-xs text-zinc-700 hover:text-zinc-400 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && (
          <div className="flex items-center justify-center h-24 text-zinc-700 text-xs">
            Loading…
          </div>
        )}

        {!loading && jobs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-2">
            <div className="text-zinc-800 text-4xl select-none">↑</div>
            <p className="text-sm text-zinc-500">No exports yet</p>
            <p className="text-xs text-zinc-700">
              Select objects on the left and click Export.
            </p>
          </div>
        )}

        {/* ── Active / in-progress jobs ── */}
        {activeJobs.map((job) => {
          const objects = liveObjects(job);
          const pct = overallPct(job);
          const runningCount = objects.filter((o) => o.status === 'running').length;
          const doneCount = objects.filter((o) => o.status === 'done').length;

          // Sort: running → queued → done → failed so active work stays at the top
          const statusOrder: Record<string, number> = { running: 0, queued: 1, done: 2, failed: 3 };
          const sortedObjects = [...objects].sort(
            (a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9),
          );

          return (
            <div key={job.jobId} className="border-b border-zinc-800">
              {/* Job summary row */}
              <div className="px-4 py-2.5 bg-zinc-900/60">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                  <span className="text-xs font-medium text-white flex-1 truncate">
                    {job.connectionName}
                  </span>
                  <span className="text-xs text-zinc-600 tabular-nums shrink-0">
                    {runningCount > 0
                      ? `${runningCount} running`
                      : `${doneCount} / ${objects.length} done`}
                  </span>
                </div>
                {/* Overall progress bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-zinc-800 rounded-full h-1">
                    <div
                      className="h-1 rounded-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-600 tabular-nums w-8 text-right">{pct}%</span>
                </div>
              </div>

              {/* Per-object rows — running first, then queued, then done */}
              <div className="divide-y divide-zinc-800/30">
                {sortedObjects.map((obj) => (
                  <ObjectRow key={obj.name} obj={obj} jobId={job.jobId} />
                ))}
              </div>
            </div>
          );
        })}

        {/* ── Completed jobs ── */}
        {completedJobs.length > 0 && (
          <>
            {activeJobs.length > 0 && (
              <div className="px-4 py-1.5 text-xs text-zinc-700 uppercase tracking-wider bg-zinc-900/30 border-b border-zinc-800/40">
                Completed
              </div>
            )}
            {completedJobs.map((job) => {
              const objects = liveObjects(job);
              const doneCount = objects.filter((o) => o.status === 'done').length;
              const failedCount = objects.filter((o) => o.status === 'failed').length;
              return (
                <CompletedJobRow
                  key={job.jobId}
                  job={job}
                  objects={objects}
                  doneCount={doneCount}
                  failedCount={failedCount}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Per-object row (used in active jobs and expanded completed jobs) ── */
function ObjectRow({ obj, jobId }: { obj: ObjectExportState; jobId: string }) {
  const isDone    = obj.status === 'done';
  const isRunning = obj.status === 'running';
  const isFailed  = obj.status === 'failed';
  const isQueued  = obj.status === 'queued';

  const hasTotal = obj.totalRows !== undefined && obj.totalRows > 0;
  const pct = isDone
    ? 100
    : hasTotal
    ? Math.min(99, Math.floor((obj.rowsWritten / obj.totalRows!) * 100))
    : undefined;

  const rowLabel = hasTotal
    ? `${obj.rowsWritten.toLocaleString()} / ${obj.totalRows!.toLocaleString()}`
    : obj.rowsWritten > 0
    ? `${obj.rowsWritten.toLocaleString()} rows`
    : '';

  return (
    <div className={`flex items-center gap-2 px-4 py-1.5 text-xs ${isDone ? 'opacity-50' : ''}`}>
      <StatusDot status={obj.status} />

      <span className="font-mono text-zinc-300 flex-1 truncate min-w-0">{obj.name}</span>

      {/* Progress bar + counters — fixed-width columns so all rows align */}
      <div className="flex items-center gap-1.5 shrink-0">
        {(isRunning || isDone) ? (
          <>
            <div className="w-24 bg-zinc-800 rounded-full h-1">
              {pct !== undefined ? (
                <div
                  className={`h-1 rounded-full transition-all duration-300 ${
                    isDone ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              ) : (
                <div className="h-1 rounded-full bg-blue-500 animate-pulse w-full" />
              )}
            </div>
            <span className="tabular-nums text-zinc-500 w-8 text-right">
              {pct !== undefined ? `${pct}%` : ''}
            </span>
            <span className="text-zinc-600 tabular-nums w-36 text-right">{rowLabel}</span>
          </>
        ) : isQueued ? (
          <>
            <div className="w-24" />
            <span className="w-8" />
            <span className="text-zinc-700 w-36 text-right">queued</span>
          </>
        ) : null}
      </div>

      {isFailed && (
        <span className="text-red-400 truncate max-w-[140px] shrink-0" title={obj.error}>
          {obj.error || 'failed'}
        </span>
      )}

      {isDone && (
        <button
          onClick={() => downloadFile(jobId, obj.csvFileName ?? `${obj.name}.csv`)}
          className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors shrink-0"
        >
          CSV
        </button>
      )}
    </div>
  );
}

/* ── Completed job row (collapsed summary, expand for per-file download) ── */
function CompletedJobRow({
  job,
  objects,
  doneCount,
  failedCount,
}: {
  job: ExportJob;
  objects: ObjectExportState[];
  doneCount: number;
  failedCount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const allOk = failedCount === 0;
  const time = new Date(job.startedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="border-b border-zinc-800/60">
      {/* Summary row */}
      <div
        className="px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-zinc-800/20 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-zinc-700 text-xs w-3">{expanded ? '▾' : '▸'}</span>
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            allOk ? 'bg-green-500' : 'bg-amber-500'
          }`}
        />
        <span className="text-xs text-zinc-400 flex-1 truncate">{job.connectionName}</span>
        <span className="text-xs text-zinc-700 shrink-0">{time}</span>
        <span className={`text-xs shrink-0 ${allOk ? 'text-green-600' : 'text-amber-500'}`}>
          {allOk
            ? `${doneCount} done`
            : `${doneCount} done, ${failedCount} failed`}
        </span>
        {doneCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadZip(job.jobId);
            }}
            className="px-2 py-0.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors shrink-0"
            title="Download all as ZIP"
          >
            ZIP
          </button>
        )}
      </div>

      {/* Expanded per-file rows */}
      {expanded && (
        <div className="border-t border-zinc-800/40 divide-y divide-zinc-800/20">
          {objects.map((obj) => (
            <ObjectRow key={obj.name} obj={obj} jobId={job.jobId} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: ExportStatus }) {
  const cls: Record<ExportStatus, string> = {
    queued:  'bg-zinc-700',
    running: 'bg-blue-500 animate-pulse',
    done:    'bg-green-500',
    failed:  'bg-red-500',
  };
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cls[status]}`} />;
}
