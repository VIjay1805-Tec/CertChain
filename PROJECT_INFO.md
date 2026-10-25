# CertiGuard Project Information

## Project Summary
CertiGuard is a blockchain-backed academic certificate verification platform for students, institutes, and companies. The application models a real-world verification workflow where:

- Students create accounts and apply for jobs.
- Institutes manage students, academic records, and certificate uploads.
- Companies post jobs, review applicants, and verify academic credentials.
- Verification can be performed using blockchain proof checks and AI-based forgery detection.

The project is split into three main components:

- Frontend: React + TypeScript + Vite
- Backend API: Express + TypeScript
- Blockchain layer: Hardhat + Solidity/Ethereum tooling

## Core Product Idea
The application is designed to reduce fake academic credentials by combining:

- SHA-256 hashing
- IPFS document storage
- Blockchain transaction proofing
- AI forgery analysis
- Notification-driven approval workflows

This creates a full certificate verification flow from enrollment to hiring decision.

## Main User Roles

### 1. Institute
Responsibilities:

- Register/login as an institute
- Add students to the system
- Add academic records
- Receive student job applications
- Upload certificates for verification
- Track verification status and pending requests

### 2. Student
Responsibilities:

- Register/login as a student
- View academic records
- Browse available jobs
- Apply with a cover note
- Track application and verification progress
- Review status notifications

### 3. Company
Responsibilities:

- Register/login as a company
- Post job opportunities
- Review applications from students
- Choose verification tier for academic proof checks
- Pay for verification
- Trigger blockchain and AI verification workflows
- View verification history and results

## Application Flow
The app behavior is defined by the route and store logic in the frontend:

- App loads with the main router in `src/App.tsx`
- Auth page is shown at `/`
- After login, the user is routed to `/dashboard`
- The dashboard differs by `session.user.role`:
  - `institute` -> `InstituteDashboard`
  - `student` -> `StudentDashboard`
  - `company` -> `CompanyDashboard`

## Frontend Stack
Technologies:

- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Lucide React
- Supabase JavaScript client

### Frontend folder structure

- `src/App.tsx` - app router and root layout
- `src/main.tsx` - bootstrap entry point
- `src/pages/` - role-specific dashboards and auth screen
- `src/components/` - reusable dashboard components and UI elements
- `src/store/AppStore.tsx` - central app state and business logic
- `src/types/schema.ts` - database-like application types and interfaces
- `src/lib/mockBackend.ts` - mock backend helpers and blockchain/mock metadata
- `src/index.css` - global styling

## State Management
The project uses a centralized store implemented in `src/store/AppStore.tsx`.

This store manages:

- Auth session
- Users, institutes, students, companies
- Academic records
- Certificates
- Jobs and applications
- Verification records
- Notifications
- Toast notifications
- Role-based helper methods

The store is designed as a mock application state layer that mirrors a relational database structure.

## Data Model
Key models defined in `src/types/schema.ts` include:

- `User`
- `Institute`
- `Student`
- `Company`
- `AcademicRecord`
- `Certificate`
- `Job`
- `Application`
- `Verification`
- `AppNotification`
- `AuthSession`

The schema includes status types such as:

- `UserRole`: institute | student | company
- `VerificationStatus`: pending | verified | suspicious | invalid
- `VerificationTier`: blockchain | ai_forgery | combined
- `ApplicationStage`: applied through selected/rejected states

## Verification Workflow
The company verification process is expressed in the dashboards and store logic.

Typical flow:

1. Student applies for a job.
2. Institute receives the application notification.
3. Institute uploads a certificate for the student.
4. Company selects a verification tier.
5. System requests a verification.
6. Payment is simulated or triggered via the app workflow.
7. Blockchain verification is run if relevant.
8. AI forgery detection is run if relevant.
9. Final verdict is produced and stored in the verification record.

## Backend Stack
The backend is under `backend/` and uses:

- Express.js
- TypeScript
- Supabase
- PostgreSQL client support
- Ethers.js
- Pinata/IPFS integration
- Multer for file uploads
- Razorpay integration
- Tesseract.js for OCR-related processing
- PDF parsing utilities

### Backend purpose
The backend is responsible for handling API endpoints, certificate processing, Supabase data access, payment flows, and verification-related integration hooks.

## Blockchain Layer
The blockchain project lives under `blockchain/` and is built with Hardhat.

This module includes:

- Hardhat config
- Solidity contract artifacts and ignition deployment tools
- Scripts and tests
- Network configuration support

The app references blockchain proof concepts such as:

- `mockTxHash`
- `mockSha256`
- `mockIpfsCid`
- blockchain contract address fields

## Important Implementation Notes

- The frontend is not purely a static UI; it contains a significant mock-data and workflow engine.
- Authentication is mocked inside the app state, not a production-grade identity service.
- Many backend calls perform fetches to `http://localhost:5000/api`.
- The store uses mock data for seeded institute, student, company, and job records.
- Some fields represent future production integration points for actual DB and smart-contract integration.

## Current Project Metadata

### Root project
Location:

- `project/`

### Root structure

- `.bolt/` - project orchestration metadata
- `backend/` - backend API service
- `blockchain/` - Hardhat blockchain project
- `backups/` - backup artifacts
- `dist/` - build output
- `src/` - frontend app source
- `package.json` - frontend dependencies and scripts
- `vite.config.ts` - Vite configuration
- `tailwind.config.js` - Tailwind setup
- `eslint.config.js` - lint configuration
- `tsconfig*.json` - TypeScript config files

## Available Frontend Scripts
From `project/package.json`:

- `npm run dev` -> start Vite dev server
- `npm run build` -> production build
- `npm run lint` -> ESLint run
- `npm run preview` -> preview build locally
- `npm run typecheck` -> TypeScript validation

## Dependency Snapshot
Frontend dependencies:

- `@supabase/supabase-js`
- `lucide-react`
- `react`
- `react-dom`
- `react-router-dom`

Development dependencies:

- `@vitejs/plugin-react`
- `typescript`
- `vite`
- `tailwindcss`
- `eslint`
- `postcss`

Backend dependencies (from `backend/package.json`):

- `express`
- `cors`
- `dotenv`
- `ethers`
- `pg`
- `multer`
- `pdf-parse`
- `pinata`
- `razorpay`
- `tesseract.js`
- `@supabase/supabase-js`

## Notable Files

- `src/App.tsx` - routing and session-aware app shell
- `src/store/AppStore.tsx` - business logic and mock backend orchestration
- `src/types/schema.ts` - data contract definitions
- `src/pages/AuthPage.tsx` - login/register experience
- `src/pages/InstituteDashboard.tsx` - institute operations and certificate handling
- `src/pages/StudentDashboard.tsx` - job and record tracking
- `src/pages/CompanyDashboard.tsx` - jobs, applicants, verification flow
- `backend/src/server.ts` - backend entry point
- `blockchain/README.md` - Hardhat sample project readme

## Assumptions and Current Status
This project appears to be an MVP / prototype, not a fully production-ready system. The codebase includes mock flows and sample data that demonstrate the intended architecture and user journey.

The app is structured for future productionization with clear separation between:

- presentation layer
- business logic store
- API integration layer
- verification engine
- blockchain proof layer

## Recommended Next Steps

- Replace mock auth and seed data with real backend authentication
- Connect the frontend store to actual API endpoints instead of mock data
- Add formal backend route documentation
- Integrate Solidity contracts for real certificate issuance and verification
- Add unit and end-to-end tests
- Secure the environment variables and API credentials

## Short Project Description
CertiGuard is a role-based blockchain-powered certificate verification platform that helps institutes, students, and companies manage academic credential trust, streamline hiring, and detect document fraud using blockchain and AI-based verification.
