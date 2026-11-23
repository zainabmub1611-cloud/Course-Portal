# CourseLearn — Online Training & Course Management Platform

A premium, professional Learning Management System (LMS) built with Next.js 16, featuring a complete course management workflow for administrators and a polished learning experience for students.

## Features

### Public Website
- Premium homepage with hero, featured courses, pricing plans, and about sections
- Course catalog with search and filtering
- Subscription plan selection
- Student registration with plan selection
- Responsive design across desktop, tablet, and mobile

### Admin Portal
- **Dashboard** — Real-time statistics, charts (course performance, student completion), recent activity
- **Student Management** — Search, filter, view profiles, assign plans, edit/delete
- **Course Management** — Card-based course grid with topics, videos, materials, assignments, and certificate configuration
- **Course Editor** — Tabbed interface for managing topics, video lessons, learning materials, assignments, and certificate templates
- **Learning Materials** — Upload PDFs, documents, presentations, and external links
- **Assignment Management** — Create assignments with file attachments and due dates
- **Submission Review** — Review student submissions, download files, add review notes
- **Subscription Plans** — Create/edit plans with dynamic features, pricing, and durations
- **Certificate Management** — View issued certificates and configure templates
- **Settings** — Admin profile and password management

### Student Portal
- **Dashboard** — Welcome header, subscription status, learning stats, continue learning
- **My Courses** — Course grid with progress tracking and video thumbnails
- **Learning Environment** — Premium video player with:
  - Compact view with expand-to-fullscreen
  - Real video completion tracking (85% watch-time enforcement)
  - Topic sidebar with lesson navigation
  - Learning materials section
  - Assignment panel (locked until all videos completed)
  - Previous/Next lesson navigation
- **My Assignments** — Status tracking (locked, available, submitted, reviewed)
- **My Subscription** — Plan details, progress bar, renewal flow
- **My Certificates** — Certificate gallery with PDF download
- **My Profile** — Edit profile, change password

### Key Business Logic
- **Video Completion Tracking** — Backend enforces 85% watch-time requirement; seeking to the end doesn't mark as complete
- **Assignment Unlocking** — Assignments remain locked until ALL required videos are completed
- **Certificate Auto-Issue** — Certificates are automatically issued when a course is completed (all videos watched)
- **Certificate PDF Generation** — Real PDF download via Puppeteer/Chromium
- **Subscription Expiry** — Backend checks subscription validity on every protected route
- **Role-Based Access** — Admin and student roles with backend enforcement

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 with shadcn/ui (New York)
- **Database**: Prisma ORM with SQLite
- **Authentication**: Custom cookie-based session with PBKDF2 password hashing
- **Charts**: Recharts
- **PDF Generation**: Puppeteer
- **Icons**: Lucide React
- **Fonts**: Inter (body) + Manrope (headings)

## Getting Started

### Prerequisites
- Node.js 18+ or Bun
- A GitHub account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/mkmasterkids23-bit/Course-Portal.git
cd Course-Portal
```

2. Install dependencies:
```bash
bun install
# or
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Set up the database:
```bash
bun run db:push
# or
npx prisma db push
```

5. Start the development server:
```bash
bun run dev
# or
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Default Credentials

The platform auto-creates a default admin on first visit:
- **Email**: `admin@courselearn.dev`
- **Password**: `admin123`

Please change the admin password after first login.

## Available Scripts

- `bun run dev` — Start development server
- `bun run build` — Build for production
- `bun run start` — Start production server
- `bun run lint` — Run ESLint
- `bun run db:push` — Push Prisma schema to database
- `bun run db:generate` — Generate Prisma client
- `bun run db:migrate` — Run database migrations

## Project Structure

```
src/
├── app/
│   ├── api/                    # API routes (auth, admin, student, public)
│   ├── globals.css             # Global styles + design system
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # SPA entry point (hash-based routing)
├── components/
│   ├── admin/                  # Admin portal components
│   ├── student/                # Student portal components
│   ├── public/                 # Public website components
│   ├── shared/                 # Shared components (brand, thumbnails, etc.)
│   └── ui/                     # shadcn/ui component library
├── lib/
│   ├── auth/                   # Authentication helpers
│   ├── course-utils.ts         # Course completion logic
│   ├── certificate-html.ts     # Certificate HTML builder
│   ├── storage.ts              # File upload helpers
│   └── db.ts                   # Prisma client
├── hooks/                      # Custom React hooks
├── stores/                     # Zustand stores
└── types/                      # TypeScript types
```

## Design System

### Colors
| Token | Hex | Usage |
|---|---|---|
| Primary Navy | #172554 | Brand, primary actions |
| Muted Teal | #0F766E | Accent, active states |
| Background | #F8FAFC | Page background |
| Card | #FFFFFF | Card surfaces |
| Success | #15803D | Success states |
| Warning | #B45309 | Warning states |
| Error | #B91C1C | Error states |

### Typography
- **Headings**: Manrope (semibold, tight tracking)
- **Body**: Inter (optimized legibility)

## License

This project is proprietary. All rights reserved.
