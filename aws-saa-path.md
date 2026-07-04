# AWS Solutions Architect Associate (SAA-C03) — Study Plan

**Target exam date:** End of June / early July 2026
**Total video study:** ~37 hours
**Practice:** Tutorials Dojo + Pluralsight practice exam

## Selected Pluralsight courses

| # | Course | Domain Focus | Length | Author | Last Updated |
|---|--------|--------------|--------|--------|--------------|
| 1 | Certification Essentials | Orientation | 48m | Andru Estes | May 2025 |
| 2 | Fundamental Services | All domains (foundation) | 14h 7m | Kroonenburg + Estes | Apr 2024 |
| 3 | Security and Governance | Domain 1 (30% — Secure) | 5h 22m | Kroonenburg + Estes | Apr 2024 |
| 4 | Scaling, Availability, and DNS | Domain 2 (26% — Resilient) | 6h 36m | Kroonenburg + Estes | Apr 2024 |
| 5 | Storage, Databases, ML, and Big Data Analytics | Domain 3 (24% — High-Performing) | 8h 17m | Andru Estes | Nov 2024 |

## Practice materials

- **Tutorials Dojo** SAA-C03 practice exams (account already created at portal.tutorialsdojo.com)
- **Pluralsight** SAA-C03 practice exam (2h 10m, included with subscription)
- **AWS official sample questions** (free, 20 questions)

## Week-by-week schedule

### Week 1 (June 4-10) — Foundation
- Day 6 (today, Thu): Certification Essentials (1h)
- Day 7 (Fri): Start Fundamental Services — IAM module
- Days 8-10 (weekend + Mon): Continue Fundamental Services — VPC, EC2, S3 modules
- Hands-on: Create first IAM user, create first VPC, launch first EC2 instance

### Week 2 (June 11-17) — Security and Resilience
- Finish Fundamental Services (Mon-Tue)
- Security and Governance course (Tue-Thu, ~5h)
- Scaling, Availability, and DNS course (Thu-Sat, ~7h)
- Hands-on: IAM policies, Auto Scaling Group, ELB, Route 53 record set

### Week 3 (June 18-24) — Storage, DBs, and First Practice Exams
- Storage, Databases, ML, Big Data course (Mon-Wed, ~8h)
- **Buy Tutorials Dojo SAA-C03 practice bundle**
- **Take TD Diagnostic Exam** (Thursday)
- Identify weak domains, plan Week 4 around them
- Hands-on: RDS Multi-AZ, S3 lifecycle policy, DynamoDB basics

### Week 4 (June 25 - July 1) — Practice and Exam
- Daily TD practice exam in Review Mode (~2h/day)
- Re-watch Pluralsight modules covering weak domains
- Take Pluralsight practice exam mid-week
- **Book real exam for end of week or early July**

## Domain weighting reminder

| Domain | Weight |
|--------|--------|
| 1. Design Secure Architectures | 30% |
| 2. Design Resilient Architectures | 26% |
| 3. Design High-Performing Architectures | 24% |
| 4. Design Cost-Optimized Architectures | 20% |

## Cost-Optimized Architectures (Domain 4 — 20%)

Not a dedicated course in this plan. Covered via:
- Cost-optimization topics within Fundamental Services
- AWS Free Tier reading + console hands-on with Cost Explorer
- Tutorials Dojo practice questions (this is where the gaps will surface)

## Exam day target

- **Pass at 720/1000 minimum**
- **Aim for 800+** for confidence and to leave margin
- Exam fee budgeted: $150 USD

## Bonus exposure
- **June 29, 2026:** AWS-hosted "Fundamentals of Amazon EKS" workshop registered
  Early Kubernetes-on-AWS exposure ahead of CKA prep in Weeks 12-17. Not core SAA-C03 material but supports the longer-term SRE pivot.


## Module 2 (Governance) — Complete

**Date:** June 22, 2026
**Quiz score:** 8/10
**Pluralsight guided lab:** Tags and Resource Groups — completed

### Concepts that landed clearly
- AWS Organizations multi-account hierarchy with OUs and SCPs
- AWS Config for configuration state tracking (vs CloudTrail for API call audit)
- Cost optimization stack: Cost Explorer (view) → Budgets (alert) → Cost & Usage Reports (export) → Savings Plans (commit) → Compute Optimizer (right-size)

### Concepts to reinforce
- Cross-account roles via sts:AssumeRole — same mechanic as Lab 02, applied across two accounts
- Trusted Advisor — AWS-provided best-practice scanner across 5 categories (cost, performance, security, fault tolerance, service limits)

### Next session
- Lab 08 (own portfolio): cross-account role + Organizations/SCP simulation OR cost-discipline tooling

## Scaling, Availability, and DNS — Module 1 (ELB) Complete

**Date:** June 25, 2026
**Quiz score:** 10/10 (first perfect score)
**Course completion:** 21% (Module 1 of 5)

### Concepts that landed clearly
- Three load balancer types (ALB Layer 7, NLB Layer 4 extreme performance, CLB legacy)
- Sticky sessions and when they're appropriate (stateful apps) vs anti-pattern (stateless)
- Layer 7 vs Layer 4 distinction and which traffic patterns each suits

### Concepts to reinforce
- Deregistration delay as "graceful drain" pattern (300s default, max 3600s)

### Next session (Friday)
- Module 2: Monitoring (CloudWatch deeper) — 56m
- Module 3: High Availability and Scaling — 1h 45m (exam-critical Auto Scaling material)
- Lab 09 (own portfolio): Auto Scaling Group + ALB from scratch


## Scaling, Availability, and DNS Course — COMPLETE

**Date:** July 4, 2026
**Course completion:** 100%

### Quiz scores
- Module 1 ELB: 10/10 (perfect)
- Module 2 Monitoring: 9/10
- Module 3 HA + Scaling: 8/10
- Module 4 Route 53: 10/10 (perfect)
- Module 5 Caching: 7/8

**Cumulative running average across all 11 quizzes taken: ~8.7/10**

### Domain 2 (Resilient Architectures, 26% of exam)

Substantively covered by:
- Lab 09 (ASG + ALB from scratch with self-healing demo) — hands-on portfolio piece
- Modules 1-3 (ELB, Monitoring, HA + Scaling) — full theoretical coverage
- Route 53 (Module 4) — theoretical coverage via 10/10 quiz

### Domain 3 partial (High-Performing Architectures, 24% of exam)

Partially covered:
- Module 5 (Caching) — CloudFront, ElastiCache, DAX, Global Accelerator
- Remaining: Storage, Databases, ML, Big Data course (next course)

### Total courses complete: 4 of 5
1. Certification Essentials ✅
2. Fundamental Services ✅
3. Security and Governance ✅
4. Scaling, Availability, and DNS ✅
5. Storage, Databases, ML, and Big Data Analytics — pending

### Next session
Storage/Databases/ML/BigData course — Domain 3 finish + Domain 4 (Cost) content
