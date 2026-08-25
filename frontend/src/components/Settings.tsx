'use client';

import React, { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '@/lib/api';

export default function Settings() {
  const [maxConcurrent, setMaxConcurrent] = useState(5);
  const [inputValue, setInputValue] = useState('5');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then(({ maxConcurrent: mc }) => {
        setMaxConcurrent(mc);
        setInputValue(String(mc));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const val = parseInt(inputValue, 10);
    if (isNaN(val) || val < 1 || val > 20) {
      setError('Value must be between 1 and 20');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateSettings(val);
      setMaxConcurrent(result.maxConcurrent);
      setInputValue(String(result.maxConcurrent));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Settings</h2>
        <p className="text-sm text-zinc-500">Configure export behaviour.</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-5">
        {/* Worker pool */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            Parallel export workers
          </label>
          <p className="text-xs text-zinc-500 mb-3">
            Number of tables exported simultaneously. Higher values use more
            HANA connections. Recommended: 3–8.
          </p>
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="text-zinc-500 text-sm">Loading...</div>
            ) : (
              <>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setSaved(false);
                    setError(null);
                  }}
                  className="w-24 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Apply'}
                </button>
                {saved && (
                  <span className="text-sm text-green-400">Saved</span>
                )}
              </>
            )}
          </div>
          {error && (
            <p className="text-xs text-red-400 mt-2">{error}</p>
          )}
        </div>

        <hr className="border-zinc-800" />

        {/* CSV output path */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            CSV output directory
          </label>
          <p className="text-xs text-zinc-500 mb-2">
            Exported files are saved here. Each job creates a sub-folder named
            by its job ID.
          </p>
          <code className="block text-xs font-mono bg-zinc-800 text-zinc-300 px-3 py-2 rounded-md">
            &lt;project-root&gt;/csv/&lt;jobId&gt;/&lt;TABLE_NAME&gt;.csv
          </code>
        </div>

        <hr className="border-zinc-800" />

        {/* How to import */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            Connection import tip
          </label>
          <p className="text-xs text-zinc-500 leading-relaxed">
            On the <strong className="text-zinc-300">Connections</strong> tab,
            use <strong className="text-zinc-300">Import from VCAP</strong> to
            paste your CAP project&apos;s{' '}
            <code className="font-mono bg-zinc-800 px-1 rounded">
              default-env.json
            </code>{' '}
            and auto-extract the HANA credentials. The{' '}
            <code className="font-mono bg-zinc-800 px-1 rounded">hana</code>{' '}
            service entry is used automatically.
          </p>
        </div>
      </div>

      {/* Current status */}
      {!loading && (
        <div className="text-xs text-zinc-600">
          Active setting: <strong className="text-zinc-400">{maxConcurrent} worker{maxConcurrent !== 1 ? 's' : ''}</strong>
        </div>
      )}
    </div>
  );
}
