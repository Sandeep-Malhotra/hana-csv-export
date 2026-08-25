'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  getConnections,
  createConnection,
  updateConnection,
  deleteConnection,
  testConnection,
  getCsnStatus,
  importCsn,
  clearCsn,
} from '@/lib/api';
import {
  Connection,
  CreateConnectionPayload,
  DefaultEnvJson,
  VcapService,
  CsnStatus,
} from '@/lib/types';

const DEFAULT_FORM: CreateConnectionPayload = {
  name: '',
  host: '',
  port: 443,
  schema: '',
  user: '',
  password: '',
  encrypt: true,
  sslValidateCertificate: false,
};

interface TestState {
  [id: string]: { loading: boolean; ok?: boolean; message?: string };
}

export default function ConnectionManager() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateConnectionPayload>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // VCAP import modal
  const [showVcap, setShowVcap] = useState(false);
  const [vcapText, setVcapText] = useState('');
  const [vcapError, setVcapError] = useState<string | null>(null);

  // CSN state
  const [csnStatus, setCsnStatus] = useState<CsnStatus | null>(null);
  const [showCsnModal, setShowCsnModal] = useState(false);
  const [csnText, setCsnText] = useState('');
  const [csnLoading, setCsnLoading] = useState(false);
  const [csnError, setCsnError] = useState<string | null>(null);

  // Test states per connection
  const [testStates, setTestStates] = useState<TestState>({});

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getConnections();
      setConnections(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
    getCsnStatus().then(setCsnStatus).catch(() => setCsnStatus({ loaded: false, entityCount: 0 }));
  }, [loadConnections]);

  const openCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (conn: Connection) => {
    setEditingId(conn.id);
    setForm({
      name: conn.name,
      host: conn.host,
      port: conn.port,
      schema: conn.schema,
      user: conn.user,
      password: conn.password,
      encrypt: conn.encrypt,
      sslValidateCertificate: conn.sslValidateCertificate,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        await updateConnection(editingId, form);
      } else {
        await createConnection(form);
      }
      setShowModal(false);
      await loadConnections();
    } catch (e: any) {
      setFormError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete connection "${name}"?`)) return;
    try {
      await deleteConnection(id);
      await loadConnections();
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    }
  };

  const handleTest = async (id: string) => {
    setTestStates((prev) => ({ ...prev, [id]: { loading: true } }));
    try {
      const result = await testConnection(id);
      setTestStates((prev) => ({
        ...prev,
        [id]: { loading: false, ok: result.ok, message: result.message },
      }));
    } catch (e: any) {
      setTestStates((prev) => ({
        ...prev,
        [id]: { loading: false, ok: false, message: e.message },
      }));
    }
  };

  const handleVcapImport = () => {
    setVcapError(null);
    try {
      const parsed: DefaultEnvJson = JSON.parse(vcapText);
      const vcap = parsed.VCAP_SERVICES;
      if (!vcap) throw new Error('No VCAP_SERVICES key found');

      // Look for hana service in various possible keys
      let hanaServices: VcapService[] | undefined;
      for (const key of Object.keys(vcap)) {
        if (key.toLowerCase().includes('hana')) {
          hanaServices = vcap[key];
          break;
        }
      }

      if (!hanaServices || hanaServices.length === 0) {
        throw new Error('No HANA service found in VCAP_SERVICES');
      }

      const creds = hanaServices[0].credentials;
      if (!creds) throw new Error('No credentials in HANA service');

      setForm({
        name: hanaServices[0].name || 'Imported HANA Connection',
        host: creds.host || '',
        port: Number(creds.port) || 443,
        schema: creds.schema || '',
        user: creds.user || '',
        password: creds.password || '',
        encrypt: creds.encrypt !== undefined ? creds.encrypt : true,
        sslValidateCertificate: false,
      });

      setShowVcap(false);
      setVcapText('');
      setEditingId(null);
      setFormError(null);
      setShowModal(true);
    } catch (e: any) {
      setVcapError(e.message || 'Failed to parse VCAP JSON');
    }
  };

  const handleCsnImport = async () => {
    if (!csnText.trim()) return;
    setCsnLoading(true);
    setCsnError(null);
    try {
      const result = await importCsn(csnText);
      setCsnStatus({ loaded: true, entityCount: result.entityCount });
      setShowCsnModal(false);
      setCsnText('');
    } catch (e: any) {
      setCsnError(e.message || 'Import failed');
    } finally {
      setCsnLoading(false);
    }
  };

  const handleCsnClear = async () => {
    await clearCsn();
    setCsnStatus({ loaded: false, entityCount: 0 });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Saved Connections</h2>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowVcap(true); setVcapText(''); setVcapError(null); }}
            className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors"
          >
            Import from VCAP
          </button>
          <button
            onClick={openCreate}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
          >
            + Add Connection
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded-md text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-zinc-500 text-sm py-8 text-center">
          Loading connections...
        </div>
      )}

      {/* Empty state */}
      {!loading && connections.length === 0 && (
        <div className="text-center py-16 text-zinc-500">
          <div className="text-4xl mb-3">🗄️</div>
          <p className="text-base mb-1">No connections yet</p>
          <p className="text-sm">
            Add a connection or import from a CAP project&apos;s default-env.json
          </p>
        </div>
      )}

      {/* Connection list */}
      {!loading && connections.length > 0 && (
        <div className="space-y-2">
          {connections.map((conn) => {
            const ts = testStates[conn.id];
            return (
              <div
                key={conn.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center justify-between gap-4"
              >
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate">
                      {conn.name}
                    </span>
                    {ts && !ts.loading && ts.ok !== undefined && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          ts.ok
                            ? 'bg-green-900/40 text-green-400 border border-green-700'
                            : 'bg-red-900/40 text-red-400 border border-red-700'
                        }`}
                        title={ts.message}
                      >
                        {ts.ok ? 'OK' : 'Failed'}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-zinc-400 mt-0.5 truncate">
                    {conn.host}:{conn.port} / {conn.schema}
                  </div>
                  {ts && !ts.loading && ts.message && (
                    <div
                      className={`text-xs mt-1 truncate ${
                        ts.ok ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {ts.message}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleTest(conn.id)}
                    disabled={ts?.loading}
                    className="px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors disabled:opacity-50"
                  >
                    {ts?.loading ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    onClick={() => openEdit(conn)}
                    className="px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(conn.id, conn.name)}
                    className="px-3 py-1.5 text-xs bg-red-900/40 hover:bg-red-800/60 text-red-400 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CDS Model section */}
      <div className="mt-6 pt-5 border-t border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">CDS Model (csn.json)</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Provides entity names and CSV filenames from your CAP project.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {csnStatus?.loaded && (
              <button
                onClick={handleCsnClear}
                className="px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => { setShowCsnModal(true); setCsnText(''); setCsnError(null); }}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              {csnStatus?.loaded ? 'Re-import' : 'Import csn.json'}
            </button>
          </div>
        </div>
        <div className={`text-xs px-3 py-2 rounded-md ${
          csnStatus?.loaded
            ? 'bg-green-900/20 border border-green-800/40 text-green-400'
            : 'bg-zinc-800/60 border border-zinc-700/40 text-zinc-500'
        }`}>
          {csnStatus === null
            ? 'Checking…'
            : csnStatus.loaded
            ? `Loaded — ${csnStatus.entityCount} table entries. Entity names and CSV filenames are resolved from the CDS model.`
            : 'Not loaded — raw HANA table names will be used as CSV filenames. Import csn.json for proper entity names.'}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                {editingId ? 'Edit Connection' : 'Add Connection'}
              </h3>

              {formError && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                <FormField
                  label="Display Name"
                  value={form.name}
                  onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder="e.g. Supplier Tool - Dev"
                  required
                />
                <FormField
                  label="Host"
                  value={form.host}
                  onChange={(v) => setForm((f) => ({ ...f, host: v }))}
                  placeholder="xxxxxxxx.hana.prod-ap11.hanacloud.ondemand.com"
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    label="Port"
                    type="number"
                    value={String(form.port)}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, port: Number(v) || 443 }))
                    }
                    required
                  />
                  <FormField
                    label="Schema"
                    value={form.schema}
                    onChange={(v) => setForm((f) => ({ ...f, schema: v }))}
                    placeholder="MY_SCHEMA"
                    required
                  />
                </div>
                <FormField
                  label="User"
                  value={form.user}
                  onChange={(v) => setForm((f) => ({ ...f, user: v }))}
                  placeholder="SCHEMA_USER"
                  required
                />
                <FormField
                  label="Password"
                  type="password"
                  value={form.password}
                  onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                  required
                />

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.encrypt}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, encrypt: e.target.checked }))
                      }
                      className="w-4 h-4 accent-blue-500"
                    />
                    <span className="text-sm text-zinc-300">Encrypt</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.sslValidateCertificate}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          sslValidateCertificate: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-blue-500"
                    />
                    <span className="text-sm text-zinc-300">Validate SSL Certificate</span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Connection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VCAP Import Modal */}
      {showVcap && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Import from VCAP (default-env.json)
              </h3>
              <p className="text-sm text-zinc-400 mb-4">
                Paste the contents of your CAP project&apos;s{' '}
                <code className="font-mono text-xs bg-zinc-800 px-1 py-0.5 rounded">
                  default-env.json
                </code>{' '}
                file. The HANA credentials will be extracted automatically.
              </p>

              {vcapError && (
                <div className="mb-3 p-3 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
                  {vcapError}
                </div>
              )}

              <textarea
                value={vcapText}
                onChange={(e) => setVcapText(e.target.value)}
                placeholder='{ "VCAP_SERVICES": { "hana": [...] } }'
                rows={10}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-blue-500"
              />

              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowVcap(false)}
                  className="px-4 py-2 text-sm bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVcapImport}
                  disabled={!vcapText.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* CSN Import Modal */}
      {showCsnModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Import csn.json</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Paste the full content of your CAP project&apos;s{' '}
                <code className="font-mono text-xs bg-zinc-800 px-1 py-0.5 rounded">csn.json</code>{' '}
                file (usually at{' '}
                <code className="font-mono text-xs bg-zinc-800 px-1 py-0.5 rounded">gen/csn.json</code>{' '}
                after{' '}
                <code className="font-mono text-xs bg-zinc-800 px-1 py-0.5 rounded">cds build</code>).
              </p>
              {csnError && (
                <div className="mb-3 p-3 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
                  {csnError}
                </div>
              )}
              <textarea
                value={csnText}
                onChange={(e) => setCsnText(e.target.value)}
                placeholder='{ "definitions": { ... } }'
                rows={12}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-blue-500"
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowCsnModal(false)}
                  className="px-4 py-2 text-sm bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCsnImport}
                  disabled={!csnText.trim() || csnLoading}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  {csnLoading ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}

function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}
