# SAP HANA Cloud Data Export Utility

A developer tool for exporting data from SAP HANA Cloud HDI containers to CSV files.

## Features

- Manage saved HANA connections (stored in `.env/connections.json`)
- Connect to SAP HANA Cloud HDI containers
- Browse database objects (tables, views, synonyms) in a schema
- Export selected objects to individual CSV files in `./csv/`
- Stream large datasets without loading entire tables into memory
- Parallel exports with a configurable worker pool (default: 5 concurrent)
- Live progress updates via Server-Sent Events (SSE)
- Per-file download before all exports finish
- ZIP download of all completed files for a job
- Import connections from a CAP project `default-env.json` (VCAP_SERVICES format)

## Project Structure

```
hana-export-utility/
├── backend/          NestJS app (port 3001)
├── frontend/         Next.js app (port 3000)
├── csv/              CSV output directory
├── .env/
│   └── connections.json   Saved connections
├── package.json      Root workspace scripts
└── README.md
```

## Prerequisites

- Node.js 18+
- Access to SAP HANA Cloud instance

## Setup

```bash
# Install all dependencies
npm run install:all

# Start both backend and frontend in development mode
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Connection Configuration

Connections are stored in `.env/connections.json`. You can also import connections from a CAP project's `default-env.json` using the "Import from VCAP" button in the UI.

### Manual connection format

```json
{
  "connections": [
    {
      "id": "uuid-here",
      "name": "My HANA Connection",
      "host": "xxxxxxxx.hana.prod-ap11.hanacloud.ondemand.com",
      "port": 443,
      "schema": "MY_SCHEMA",
      "user": "SCHEMA_USER",
      "password": "PASSWORD",
      "encrypt": true,
      "sslValidateCertificate": false,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

### Importing from CAP default-env.json

Paste the contents of a CAP project's `default-env.json` into the "Import from VCAP" dialog. The utility will extract the `hana` service credentials and pre-fill the connection form.

## Usage

1. **Connections tab** — Add or import your HANA connection details
2. **Explorer tab** — Select a connection, browse tables/views/synonyms, select objects to export
3. **Exports tab** — Monitor live export progress, download individual CSVs or a ZIP of all files

## CSV Output

Exported files are saved to `./csv/<jobId>/<OBJECT_NAME>.csv`.

Each file can be downloaded individually as soon as it completes. All completed files for a job can be downloaded as a ZIP.

## Architecture

- **Backend**: NestJS with streaming `hdb` driver queries — never loads full tables into memory
- **Frontend**: Next.js 14 with Tailwind CSS dark-mode UI
- **Progress**: Server-Sent Events (SSE) for real-time export status
- **Concurrency**: Semaphore-based worker pool (default 5 parallel exports)
