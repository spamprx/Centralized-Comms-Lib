# Product Overview

## Vision

Comms-Library is a centralised content lifecycle platform built for educational institutions and organisations that need to create, review, and distribute communications across many channels from a single system. The platform eliminates the fragmented tooling problem where authors work in one tool, reviewers in another, and distribution teams copy-paste content into email clients, LMS portals, and messaging apps. Everything — from first draft to published post — happens inside one governed workflow.

## Problem Statement

Organisations distributing communications across Email, SMS, LMS platforms (Moodle/Canvas), WhatsApp, and social media face three persistent problems:

1. **No single source of truth.** Content is duplicated across tools, causing version drift and inconsistent messaging.
2. **Uncontrolled publishing.** Without a structured review gate, low-quality or non-compliant content reaches audiences.
3. **Slow iteration.** Manual reformatting for each channel multiplies effort and introduces errors.

Comms-Library solves all three by providing a shared authoring canvas, a configurable multi-stage review pipeline, and a template-driven multi-channel publishing engine.

## Scope

The system covers the complete content lifecycle:

| Phase | What the system does |
|-------|----------------------|
| **Create** | Rich-text editor, AI draft generation, co-authoring, template-based structure |
| **Review** | Multi-reviewer assignment, inline comments, approval/denial, rollback, AI pre-screening |
| **Distribute** | Channel-bound rendering, WhatsApp/Email sends, asset management |
| **Consume** | Reading interface, bookmarks, progress tracking, AI summarisation and tutoring |
| **Administer** | Role and group management, audit logs, monitoring dashboards, review policies |

Out of scope for the initial release: native mobile apps (web-responsive UI is provided), real-time video/audio conferencing, and third-party LMS grade pass-back.

## Target Users

| User Type | Core Need |
|-----------|-----------|
| **Authors** | Create and maintain well-structured content without fighting tooling |
| **Reviewers** | Efficiently assess, comment on, and gate-keep content quality |
| **Audience** | Reliably find, read, and learn from published material |
| **Administrators** | Govern the system — roles, policies, pipelines, monitoring |

## Key Differentiators

- **Structured workflow, not just a CMS.** Every piece of content moves through a configurable pipeline with audit trail.
- **AI throughout, not bolted on.** AI assists at creation (draft generation), review (auto-approval, screening), search (semantic ranking), and consumption (summarisation, RAG Q&A, AI tutor).
- **Template-driven multi-channel publishing.** One source document renders appropriately for Email, SMS, WhatsApp, LMS, and more — no copy-paste.
- **Component library.** Reusable blocks (headers, legal footers, info-cards) update once and propagate automatically to all linked documents.
- **Transactional reliability.** The Outbox Pattern ensures no notification or event is ever silently lost, even under partial failure.

## High-Level Feature Categories

1. **Authors Module** — content creation, state management, visibility control, tagging, co-authoring, AI drafting
2. **Reviewers Module** — approval workflows, inline comments, version comparison, AI pre-screening
3. **Audience Module** — reading, bookmarking, progress, reactions, AI summarisation and tutoring
4. **Admin Module** — roles, groups, monitoring, policies, audit logs
5. **Channels Module** — Email, SMS, Moodle, Canvas, Calendar, Push, WhatsApp, Social Media, RSS, Website
6. **Template Module** — CRUD, clone, channel bindings, translations, AI drafting, component library
7. **Search Module** — full-text, faceted filtering, semantic AI ranking
8. **Collaboration Module** — peer review, shared spaces, Q&A (stretch goals)

## Non-Functional Targets (Summary)

| Dimension | Target |
|-----------|--------|
| Latency | p95 < 100 ms, p99 < 300 ms |
| Throughput | 1 000 concurrent writes |
| Availability | 99.9 % per calendar month |
| Failover | < 30 seconds |
| Encryption | TLS 1.3 in transit, AES-256 at rest |

## Technology Stack (Implemented)

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite (TypeScript), TipTap rich-text editor |
| API | Node.js + Express (TypeScript) |
| Primary DB | PostgreSQL 16 via Prisma ORM |
| Cache | Redis (ioredis) |
| Search | Elasticsearch 8 (full-text + 384-dim dense vector) |
| Object Storage | MinIO (S3-compatible, AWS SDK v3) |
| Async messaging | Transactional Outbox → Event Bus (internal) |
| AI | External embedding service + async AI worker HTTP |
| Notifications | Notify HTTP API (email + WhatsApp) |
| Monitoring | Prometheus (`prom-client`) |
| Container infra | Docker Compose (dev), Docker images in `infra/docker/` |
