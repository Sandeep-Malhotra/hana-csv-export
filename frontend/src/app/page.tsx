'use client';

import React, { useState } from 'react';
import ConnectionManager from '@/components/ConnectionManager';
import DatabaseExplorer from '@/components/DatabaseExplorer';
import ExportDashboard from '@/components/ExportDashboard';
import Settings from '@/components/Settings';

type Tab = 'connections' | 'export' | 'settings';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('export');
  const [latestJobId, setLatestJobId] = useState<string | undefined>();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'connections', label: 'Connections' },
    { id: 'export', label: 'Export' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 px-5 py-2.5 shrink-0">
        <h1 className="text-sm font-bold text-white tracking-tight">HANA Export Utility</h1>
        <p className="text-xs text-zinc-600">SAP HANA Cloud → CSV</p>
      </header>

      {/* Tabs */}
      <div className="border-b border-zinc-800 shrink-0 px-2">
        <nav className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-white border-blue-500'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:border-zinc-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content — fills remaining height, no page scroll */}
      <div className="flex-1 min-h-0">
        {activeTab === 'connections' && (
          <div className="h-full overflow-auto p-6">
            <div className="max-w-2xl">
              <ConnectionManager />
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="flex h-full">
            {/* Left panel: object browser (fixed width) */}
            <div className="w-80 shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden">
              <DatabaseExplorer onExportStarted={setLatestJobId} />
            </div>
            {/* Right panel: live export queue */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <ExportDashboard newJobId={latestJobId} />
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="h-full overflow-auto p-6">
            <div className="max-w-xl">
              <Settings />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
