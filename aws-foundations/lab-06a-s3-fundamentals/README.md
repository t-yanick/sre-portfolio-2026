# AWS Lab 06a — S3 Fundamentals

Hands-on with core S3 mechanics: bucket creation, versioning, lifecycle policies, and public-read bucket policies. Demonstrates the **deliberate public-access security model** that AWS uses to prevent accidental S3 leaks.

## What it demonstrates

- **S3 bucket creation** via CLI (`aws s3api create-bucket`) and console
- **Versioning** keyed on (bucket + object key) — not on file content or local path
- **Lifecycle policies** with multi-stage storage class transitions and noncurrent-version handling
- **Bucket policies** with `Principal: *` for anonymous public read
- **Block Public Access** — the 4-layer safety net AWS uses to prevent accidental public buckets
- **The `s3:GetObject` vs `s3:ListBucket` distinction** — public can read known objects but cannot enumerate the bucket
- **Cleanup of versioned buckets** — delete markers + object versions require explicit handling

## Bucket and architecture

- Name: `tyanick-lab06a-<timestamp>`
- Region: us-east-1
- Versioning: Enabled
- Lifecycle rule: `lab06a-archive-old-objects`
  - Current versions: Standard → Standard-IA (30d) → Glacier Flexible Retrieval (90d)
  - Noncurrent versions: Standard → Standard-IA (30d)
  - Noncurrent versions permanently deleted after 365 days
- Bucket policy: public `s3:GetObject` on `arn:aws:s3:::<bucket>/*`
- Block Public Access: `RestrictPublicBuckets=false`, `BlockPublicPolicy=false` (others left blocking)

## Versioning behavior — observed

Uploaded `test.txt`, modified the local file, re-uploaded with the same key. S3 kept both versions:

```bash
$ aws s3api list-object-versions --bucket <name> --prefix test.txt
[Two version entries with different VersionIds, sizes, timestamps]
```

**Key insight:** S3 versioning operates on (bucket + object key). Same key = same version history, regardless of local file path, content similarity, or file extension. Different key = separate object history.

## The Block Public Access gotcha — observed

After enabling the bucket policy in the console, the public URL still returned `Access Denied`. Diagnostic via CLI revealed:

```json
{
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": false,
    "RestrictPublicBuckets": true  ← this was still blocking
}
```

`RestrictPublicBuckets=true` means: *"Block public and cross-account access through any public bucket policies"* — overriding the bucket policy even though the policy was correctly saved.

**Fix:**

```bash
aws s3api put-public-access-block \
  --bucket <name> \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

After this, the public URL loaded normally.

**Production lesson:** Block Public Access has 4 sub-settings, each independently restrictive. Turning off "Block all public access" in the console relaxes the top-level switch but does not auto-disable all 4 sub-settings. Public access requires deliberately defeating all 4 layers — by design.

## Bucket policy used

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowPublicReadOnly",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::tyanick-lab06a-<timestamp>/*"
        }
    ]
}
```

What it grants: anonymous read on any object whose URL is known.
What it does NOT grant: listing, writing, deleting, ACL changes, bucket-level operations.

## Tested boundaries

| URL | Expected | Observed |
|---|---|---|
| `s3://<bucket>/test.txt` (authenticated) | works | ✅ |
| `https://<bucket>.s3.us-east-1.amazonaws.com/test.txt` (public, incognito) | works | ✅ |
| `https://<bucket>.s3.us-east-1.amazonaws.com/` (public listing) | Access Denied | ✅ Access Denied |

The bucket root URL returning Access Denied confirms `s3:GetObject` ≠ `s3:ListBucket` — public can read known files but cannot discover what's in the bucket.

## Storage classes covered (exam-relevant)

| Class | Use case | Min storage duration | Min object size |
|---|---|---|---|
| Standard | Active, frequently accessed | None | None |
| Standard-IA | Infrequently accessed, rapid retrieval when needed | 30 days | 128 KB |
| One Zone-IA | Same as IA but single AZ (cheaper, less resilient) | 30 days | 128 KB |
| Glacier Instant Retrieval | Archive with millisecond retrieval | 90 days | 128 KB |
| Glacier Flexible Retrieval | Archive with minutes-to-hours retrieval | 90 days | 40 KB |
| Glacier Deep Archive | Lowest cost, 12-48h retrieval | 180 days | 40 KB |

**Exam pattern:** *"Logs accessed often for 30 days, then occasionally for 90 days, then archived for 7 years"* → Standard → Standard-IA → Glacier Deep Archive.

## S3 cost dimensions

1. **Storage** — $/GB/month, varies by class
2. **Requests** — $/1000 requests, tiered by type:
   - PUT, COPY, POST, LIST: more expensive
   - GET, SELECT: cheaper
   - DELETE, CANCEL: free
3. **Data transfer out** — $/GB egress (often the dominant cost)

**Optimization insight:** for write-heavy workloads, batch small uploads into fewer larger objects — request cost dominates over storage cost.

## Cleanup

- Emptied bucket (handles versioned objects and delete markers)
- Deleted bucket via `aws s3api delete-bucket`
- Verified clean via `aws s3 ls` — only the April Terraform orphan remains (documented in `prior-aws-experience/aws-media-pipeline.md` for Week 7 cleanup)

## What I'd add for production

1. **Server-side encryption** (SSE-S3 default, SSE-KMS for compliance)
2. **MFA Delete** on critical buckets to prevent accidental version deletion
3. **Object Lock in Compliance Mode** for regulatory data (immutable for retention period, even by root)
4. **VPC Endpoint for S3** to keep traffic off the public internet
5. **CloudFront in front** for distributed delivery and SSL
6. **Bucket-level logging** to a separate audit bucket for compliance
7. **Restrict the public policy** to specific object prefixes (e.g., `/public/*`) instead of the whole bucket
8. **Tag-based cost allocation** for chargeback to the right team

