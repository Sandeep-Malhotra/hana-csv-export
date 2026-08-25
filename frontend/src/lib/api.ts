import {
  Connection,
  CreateConnectionPayload,
  UpdateConnectionPayload,
  DbObject,
  ExportJob,
  ExportObjectInput,
  ProgressEvent,
  TestConnectionResult,
  CsnStatus,
} from './types';

const BASE_URL = 'http://localhost:3001';

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.message || body.error || message;
    } catch (_) {
      // ignore JSON parse error
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ─── Connections ──────────────────────────────────────────────────────────────

export function getConnections(): Promise<Connection[]> {
  return apiFetch<Connection[]>('/api/connections');
}

export function getConnection(id: string): Promise<Connection> {
  return apiFetch<Connection>(`/api/connections/${id}`);
}

export function createConnection(data: CreateConnectionPayload): Promise<Connection> {
  return apiFetch<Connection>('/api/connections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateConnection(
  id: string,
  data: UpdateConnectionPayload,
): Promise<Connection> {
  return apiFetch<Connection>(`/api/connections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteConnection(id: string): Promise<void> {
  return apiFetch<void>(`/api/connections/${id}`, {
    method: 'DELETE',
  });
}

export function testConnection(id: string): Promise<TestConnectionResult> {
  return apiFetch<TestConnectionResult>(`/api/connections/${id}/test`, {
    method: 'POST',
  });
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export function getObjects(
  connectionId: string,
  search?: string,
): Promise<DbObject[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch<DbObject[]>(`/api/metadata/${connectionId}/objects${params}`);
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function startExport(
  connectionId: string,
  objects: ExportObjectInput[],
): Promise<{ jobId: string }> {
  return apiFetch<{ jobId: string }>('/api/export', {
    method: 'POST',
    body: JSON.stringify({ connectionId, objects }),
  });
}

export function getSettings(): Promise<{ maxConcurrent: number }> {
  return apiFetch<{ maxConcurrent: number }>('/api/export/settings');
}

export function updateSettings(maxConcurrent: number): Promise<{ maxConcurrent: number }> {
  return apiFetch<{ maxConcurrent: number }>('/api/export/settings', {
    method: 'POST',
    body: JSON.stringify({ maxConcurrent }),
  });
}

export function getJobs(): Promise<ExportJob[]> {
  return apiFetch<ExportJob[]>('/api/export/jobs');
}

export function getJob(jobId: string): Promise<ExportJob> {
  return apiFetch<ExportJob>(`/api/export/jobs/${jobId}`);
}

// ─── Progress (SSE) ───────────────────────────────────────────────────────────

/**
 * Subscribe to SSE progress events for a job.
 * Returns a cleanup function to close the connection.
 */
export function subscribeProgress(
  jobId: string,
  onEvent: (event: ProgressEvent) => void,
  onError?: (err: Event) => void,
  onDone?: () => void,
): () => void {
  const url = `${BASE_URL}/api/progress/${jobId}`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (e) => {
    try {
      const data: ProgressEvent = JSON.parse(e.data);
      onEvent(data);
      if (data.done) {
        eventSource.close();
        onDone?.();
      }
    } catch (err) {
      console.error('SSE parse error:', err);
    }
  };

  eventSource.onerror = (e) => {
    onError?.(e);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}

// ─── Download ─────────────────────────────────────────────────────────────────

export function getDownloadUrl(jobId: string, filename: string): string {
  return `${BASE_URL}/api/download/${jobId}/${encodeURIComponent(filename)}`;
}

export function getZipUrl(jobId: string): string {
  return `${BASE_URL}/api/download/${jobId}/zip`;
}

export function downloadFile(jobId: string, filename: string): void {
  const link = document.createElement('a');
  link.href = getDownloadUrl(jobId, filename);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadZip(jobId: string): void {
  const link = document.createElement('a');
  link.href = getZipUrl(jobId);
  link.download = `export-${jobId}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ─── CSN ──────────────────────────────────────────────────────────────────────

export function getCsnStatus(): Promise<CsnStatus> {
  return apiFetch<CsnStatus>('/api/csn/status');
}

export function importCsn(content: string): Promise<{ entityCount: number }> {
  return apiFetch<{ entityCount: number }>('/api/csn', {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function clearCsn(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/api/csn', { method: 'DELETE' });
}
