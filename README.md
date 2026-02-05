# CloudClawMac

A multitenant platform for provisioning MacStadium Orka VMs with a user-friendly web interface.

## Overview

CloudClawMac allows users to run powerful AI agents and tools in isolated macOS VMs without executing anything on their local machines. Built with a focus on security and ease of use.

## Architecture

- **Backend**: Node.js + Fastify API with PostgreSQL
- **Frontend**: React + Vite
- **Infrastructure**: MacStadium Orka for macOS VM provisioning

## Project Structure

```
cloudclawmac/
├── backend/                 # Fastify API server
│   ├── src/
│   │   ├── config/         # Configuration management
│   │   ├── models/         # Database models and queries
│   │   ├── routes/         # API routes
│   │   ├── services/       # External service integrations (Orka)
│   │   ├── middleware/     # Auth and tenant isolation
│   │   ├── migrations/     # Database migrations
│   │   └── server.js       # Main server entry point
│   ├── package.json
│   └── .env.example        # Environment variables template
├── frontend/               # React + Vite application
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── api.js         # API client
│   │   └── App.jsx        # Main app component
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Features

- **Multitenant Architecture**: Complete tenant isolation at database and API level
- **Orka Integration**: Full API integration with MacStadium Orka for VM provisioning
- **User Management**: Registration, authentication, and tenant management
- **VM Management**: Create, start, stop, and delete VMs through the web UI
- **Hand-holding Onboarding**: Step-by-step flow for new users
- **Trial Credits System**: Built-in free trial with configurable credits
- **Pricing Tiers**: Standard, Pro, and Enterprise plans
- **Audit Logging**: Security-focused audit trail

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- MacStadium Orka account (for production)

### Backend Setup

```bash
cd backend
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173` and the API at `http://localhost:3000`.

## Environment Variables

See `backend/.env.example` for all required variables:

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT token signing
- `ORKA_ENDPOINT`: MacStadium Orka API endpoint
- `ORKA_USERNAME` / `ORKA_PASSWORD`: Orka credentials (or use ORKA_TOKEN)

## Orka API Integration

The `OrkaClient` class in `backend/src/services/orka.js` handles all communication with MacStadium:

- VM lifecycle management (create, start, stop, delete)
- Health checks and status monitoring
- Image and node queries

## Database Schema

- `users`: User accounts
- `tenants`: Multitenant isolation
- `vm_instances`: VM records with Orka mapping
- `vm_sessions`: Billing/tracking sessions
- `audit_logs`: Security audit trail

## License

MIT
