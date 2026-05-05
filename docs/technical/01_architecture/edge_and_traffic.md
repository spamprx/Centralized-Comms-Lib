# Edge and Traffic Layers

## Purpose

These two layers form the outermost defensive perimeter. Their job is to ensure that only clean, authenticated, rate-compliant traffic ever reaches the API servers. They run independently of the application code and can be replaced or scaled without any API changes.

---

## Edge Protection Layer

The Edge Layer is the first contact point for all inbound traffic.

### Components

| Component | Function |
|-----------|----------|
| **WAF (Web Application Firewall)** | Blocks known exploit patterns: SQL injection attempts, XSS payloads in query strings, oversized headers, and OWASP Top-10 signatures |
| **DDoS Protection** | Rate-limits traffic at the IP and network level before it reaches any server. Absorbs volumetric flood attacks. |
| **Bot Filtering** | Identifies and drops automated bot traffic that does not present valid browser fingerprints or that matches known malicious user-agent patterns |
| **IP Rate Limiting** | Applies per-IP connection and request rate limits. Prevents any single client from monopolising bandwidth. |

### Design rationale

All four Edge components run before TLS termination. This means malicious traffic is dropped at minimum cost — no TLS handshake is completed, no application server CPU is spent parsing the request.

### Current deployment note

In the Docker Compose development environment these protections are not present (traffic goes directly to the backend container). In production deployment these are handled by the cloud provider's edge services (e.g. AWS CloudFront + WAF, Cloudflare) placed in front of the load balancer.

---

## Traffic Layer

The Traffic Layer sits between the Edge and the API server. It handles transport-level concerns.

### Components

| Component | Function |
|-----------|----------|
| **TLS Termination** | Decrypts HTTPS traffic (TLS 1.3). All traffic from the load balancer inward is plain HTTP within the private network. |
| **Reverse Proxy** | Accepts external connections and forwards them to backend instances. Abstracts the backend topology from clients. |
| **Load Balancer** | Distributes traffic across all healthy API server instances using a round-robin or least-connections algorithm. Health checks run at configurable intervals; degraded instances are removed automatically. |

### TLS policy

- **Minimum version:** TLS 1.3 (NFR-SEC-01)
- **Certificate management:** Certificates are provisioned and rotated by the infrastructure layer (cloud provider certificate manager or Let's Encrypt)
- **HSTS:** HTTP Strict Transport Security headers are set on all responses to prevent protocol downgrade attacks

### Health check behaviour

The load balancer polls `GET /health` on each API instance:
- **Success:** 200 OK with JSON body `{ "status": "ok", "db": "ok", "redis": "ok" }`
- **Failure:** Instance is removed from the rotation; a replacement is started if auto-scaling is configured
- **Reconnection:** Once the instance recovers (health check passes), it is re-added to the rotation

In the API codebase, health endpoints are registered in `app.ts`:
- `GET /health` — overall health
- `GET /health/db` — PostgreSQL connectivity check
- `GET /health/redis` — Redis connectivity check

---

## Request Flow Through Both Layers

```
Internet
    │
    ▼
[Edge: WAF / DDoS / Bot / IP Rate Limit]
    │  (blocked requests drop here — no backend cost)
    ▼
[Traffic: TLS Termination]
    │  (HTTPS → HTTP internally)
    ▼
[Traffic: Reverse Proxy → Load Balancer]
    │  (round-robin across API instances)
    ▼
API Server Instance → Gateway Layer
```

---

## Separation from Application Code

Neither the Edge nor Traffic layers have any knowledge of the application's business logic, authentication scheme, or API structure. They operate purely on network and transport properties. This means:

- Updating the API (new routes, changed auth scheme) requires no changes to Edge/Traffic configuration
- Scaling the API horizontally (adding instances) only requires updating the load balancer's instance list
- The Edge layer can be upgraded to a stronger WAF rule set without touching any application code
