# ADR: On using a custom auth process

## Review question

We currently have changes which implement a user management system using our cloudflare backing. This involves a lot of custom code / functionality. Instead of rolling out this implementation, and incurring the cost of ownership, are the free-to-use / opensource solutions out there that do exactly the same or is the domain specfic implementation (domain rules) relatively large that it negates the benefits of using an existing solution ?

## Report 1

Generic auth (~40% of the logic):
- Signup, login, password hashing (PBKDF2 via Web Crypto)
- Session tokens (custom HMAC-SHA256, not JWT)
- /auth/me endpoint
- CSRF via Origin header + SameSite cookies
- Rate limiting
Domain-specific (~60%):
- Project-scoped capabilities (user/editor/organizer per project) — no off-the-shelf solution does this
- Invite token system (organizer creates link, 48h TTL, atomic accept) — no off-the-shelf solution does this
- Bootstrap flow (KV admin password → bootstrap token → promote to organizer) — entirely custom
- Dual auth paths (participant sessions coexist with editor sessions, discriminated by token shape) — unusual pattern
- Capability-based route guards scoped to projects
Alternatives considered
Solution	Free/OSS	D1 support	Would replace	Would not replace
better-auth	OSS (MIT)	Yes	Signup, login, password hashing, sessions	Caps, invites, bootstrap, dual auth, project scoping
Clerk	Free tier (10k MAU)	Workers API	User accounts, sessions, passwords	Same as above + hosted dependency
Auth0	Free tier (7.5k MAU)	Workers API	User accounts, sessions	Same + CK-specific integration work
Oslo (Lucia successor)	OSS (MIT)	D1 adapter	Password hashing, session primitives	Everything else
Verdict
The domain-specific logic is too large to justify switching. Your project-scoped RBAC, invite system, bootstrap flow, and dual auth paths account for roughly 60% of the implementation complexity and none of the alternatives handle those. You'd still be writing most of the custom code — just with an additional library dependency and integration layer.
The one legitimate concern is rolling your own password hashing and session crypto. If you want to reduce risk there specifically, you could swap in better-auth for just the user account primitives (hashing, sessions) while keeping your domain logic on top. But as a full replacement? The cost of integration would exceed the maintenance cost of what you have.
Recommendation: Keep the implementation. The domain model is the dominant cost, not the generic auth plumbing. If anything, consider extracting the PBKDF2/hash utils into their own test-covered module and adding a constant-time comparison audit (you already have one in db.ts) to harden the security-critical primitives.

## Report 2

The custom implementation is the right call here.

What existing options exist
For Cloudflare Workers specifically, the viable open-source options are:

better-auth — TypeScript-first, has a CF D1 adapter, supports invite flows
Lucia (v3) — lightweight adapter-based, D1-compatible
Supabase Auth — free tier exists, but it's a separate hosted service (not Workers-native)
SaaS (Clerk, Auth0, WorkOS) — not free for production
Why they don't fit well here
The domain rules are not small — they cover the majority of the auth surface:

Concern	Domain-specific?	Library covers it?
Dual token path (participant sessions must be preserved unchanged, same cookie, same /auth/me endpoint)	Yes — core constraint	No — libraries own the session layer
Custom token format (base64url JSON + HMAC, not JWT)	Yes — must stay for participant compat	No — libraries emit JWTs or their own formats
Capability model (user/editor/organizer per project, revocable)	Yes	Partially — some libs have "organizations" but not this shape
Invite flow (URL-based, not email-tied, organizer-controlled, 48h TTL)	Yes	Partially — better-auth has invite support but email-first
Bootstrap flow (KV admin → bootstrap token → promote)	Yes	No
GDPR consent fields	Yes	No
Password hashing + user CRUD	Generic	Yes ✓
Session token generation	Generic	Yes ✓
A library like better-auth would replace roughly the bottom two rows — maybe 20–25% of the implementation. The remaining 75% (dual path, custom tokens, capabilities, invite, bootstrap) would still be custom, and you'd now own the integration surface on top.

The real cost of ownership
The implementation is a contained Workers module. The ongoing risks are:

Security patches — the crypto surface is small (PBKDF2 via Web Crypto API, HMAC for tokens). No external crypto deps to patch.
No password reset — noted as out of scope, will need adding eventually
No OAuth — if SSO is ever needed, that's a future rebuild regardless of the current solution
The architecture is also deliberately simple: 4 tables, ~10 endpoints, no abstractions. That's low maintenance.

Recommendation
Keep the custom implementation. The domain rules are load-bearing enough that swapping to a library would add integration complexity without meaningfully reducing the code you own or the security surface you maintain.