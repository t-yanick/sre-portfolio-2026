# AWS Lab 10 — Route 53 (Conceptual — Hands-On Deferred)

Route 53 knowledge locked in through the Pluralsight course (Module 4 of Scaling/Availability/DNS) and 10/10 quiz score. Hands-on lab was attempted but deferred due to a real-world registrar constraint that mirrors production DNS management challenges.

## What was learned (via course + quiz)

- **DNS foundations** — hosted zones (public + private), record types (A, AAAA, CNAME, MX, TXT, NS, SOA), Alias records vs CNAME (Alias works at zone apex)
- **All 7 routing policies:**
  - **Simple** — default, one record → one value
  - **Weighted** — split traffic by percentage (traffic splitting, canary deployments)
  - **Failover** — primary + secondary, secondary serves only when primary unhealthy
  - **Geolocation** — route by user's geographic location (rule-based)
  - **Geoproximity** — route by physical distance with bias adjustment (distance-based)
  - **Latency** — route based on measured network latency (not physical distance)
  - **Multivalue Answer** — up to 8 healthy records for simple DNS-level load balancing
- **Health checks** — Route 53 monitors endpoints and integrates with failover routing
- **TTL trade-offs** — short TTL (30-60s) enables fast failover but increases query cost; long TTL (300s+) reduces cost but slows change response
- **Zone apex constraint** — CNAME cannot be used at the zone apex; must use Alias records for AWS resources

## Attempted Lab: Subdomain Delegation

The plan was to delegate a subdomain `lab.brightcleaningservices.ca` from Hostinger (the registrar for the family business domain) to a Route 53 hosted zone via NS record delegation. This is a real production pattern used by companies who keep a stable registrar for their primary domain but want AWS-controlled DNS for specific subdomains.

**The blocker:** Hostinger's DNS management panel only supports A, MX, AAAA, CNAME, SRV, TXT, and CAA record types. **No NS record type is available to customers.** This means Route 53 subdomain delegation cannot be performed through Hostinger's standard interface.

## Why I didn't switch to the alternative

Two alternatives were considered:

1. **Purchase a cheap test domain via Route 53** (~$3-5 for `.click` or `.xyz`) — would enable the full lab
2. **Migrate `brightcleaningservices.ca` fully to Route 53** — would require moving 12+ existing DNS records including MX, SPF, DKIM, DMARC that support the family business email and website

Both were rejected:
- Option 1 adds unnecessary cost when the concepts already landed via course + 10/10 quiz
- Option 2 puts the family business at risk of email/website downtime; not appropriate risk-for-reward on a learning lab

**Documenting the constraint honestly is the SRE-appropriate response.** Real production engineering involves accepting that some tools/services don't cooperate; documenting and moving forward is more valuable than forcing a workaround.

## Portfolio evidence

- **Course completion:** Scaling/Availability/DNS course, 100%
- **Route 53 quiz:** 10/10 (Module 4)
- **All 7 routing policies:** understood with use-case mapping (see notes below)

## Real production DNS notes captured (from lab planning)

The subdomain-delegation-at-registrar pattern is common in enterprises:
Primary domain: example.com (at Registrar A - stable, existing setup)
├─ @ (main site records at Registrar A) - stays untouched
├─ www (main site at Registrar A) - stays untouched
├─ mail records (email at Registrar A) - stays untouched
└─ api.example.com → NS delegation to Route 53
└─ Route 53 hosted zone for "api.example.com"
├─ (AWS-managed records for API infrastructure)
This is genuinely how many companies migrate incrementally to AWS DNS without doing a full registrar migration.

## Exam readiness for Route 53

Based on Route 53 concepts covered in Module 4 + quiz score:
- Can identify appropriate routing policy for a given scenario
- Understand health check + failover integration
- Know TTL implications for DNS caching
- Understand the Alias vs CNAME distinction at zone apex
- Understand hosted zone concepts (public vs private)

**Route 53 is exam-ready via course completion.** Hands-on lab would be nice-to-have but not required for exam preparation.

## Future revisit

If a future lab requires a Route 53-controlled domain (e.g., static website hosting with CloudFront + Route 53, or a real cross-region failover architecture), I will register a dedicated test domain at that point.

