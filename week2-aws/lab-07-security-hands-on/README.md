# AWS Lab 07 — Security Hands-On (KMS + CloudTrail)

Two real Module 1 (Security) services demonstrated in my own AWS account: customer-managed KMS keys with full encrypt/decrypt round trip, and CloudTrail audit logging with a persistent S3 trail.

## What it demonstrates

- **Customer-managed KMS keys (CMK)** — created via console, policy generated with admin/usage separation
- **Key policy structure** — three statements: root account access, key administrators (manage), key users (encrypt/decrypt). Separation of duties principle
- **Envelope encryption** — KMS encrypts data with a single-use data key, then encrypts that data key with the CMK. Full round trip demonstrated via CLI
- **Automatic key rotation** — enabled annual rotation; AWS handles key material refresh transparently
- **KMS alias caveats** — `get-key-rotation-status` requires KeyId, not alias (real gotcha — exam-relevant)
- **CloudTrail trails to S3** — created multi-region trail with required IAM bucket policy
- **CloudTrail delivery latency** — events appear in Event History within ~15 minutes; S3 delivery has additional batch latency (5-15 min first delivery)
- **KMS deletion safety** — keys cannot be immediately deleted; must be scheduled with a 7-30 day waiting period. Data encrypted with deleted keys is permanently unrecoverable

## Sub-lab 7a — KMS

### Setup (console)

Created customer-managed key `alias/lab-07-key` with:
- Symmetric key, encrypt/decrypt usage
- Key administrators: `tyanick-admin`
- Key users: `tyanick-admin` (same user for lab; separated in production)
- Annual rotation enabled

### Round-trip demonstration (CLI)

```bash
# Encrypt a fake-sensitive file
echo "Secret API key: AKIA-FAKE-NEVER-USE-THIS" > secret-data.txt

aws kms encrypt \
  --key-id alias/lab-07-key \
  --plaintext fileb://secret-data.txt \
  --output text \
  --query CiphertextBlob | base64 --decode > secret-data.txt.encrypted

# Inspect the ciphertext
hexdump -C secret-data.txt.encrypted | head -3
# Output: bytes start with 01 02 02 00 (KMS ciphertext envelope marker),
#         followed by random-looking encrypted data

# Decrypt back to plaintext
aws kms decrypt \
  --ciphertext-blob fileb://secret-data.txt.encrypted \
  --output text \
  --query Plaintext | base64 --decode
# Output: Secret API key: AKIA-FAKE-NEVER-USE-THIS
```

### Envelope encryption (what just happened under the hood)

1. KMS generated a single-use 256-bit AES data key
2. The data key encrypted the file
3. The CMK encrypted the data key
4. Both encrypted data and encrypted data key were returned as the ciphertext blob

For decryption:
1. KMS decrypted the data key using the CMK
2. The data key decrypted the file
3. Original plaintext returned

The CMK never leaves AWS HSM hardware. The data key is used once and discarded.

## Sub-lab 7b — CloudTrail

### Setup (CLI)

```bash
# Created an S3 bucket with proper CloudTrail bucket policy
aws s3api create-bucket --bucket tyanick-lab07-cloudtrail-<timestamp>

# Created and started a multi-region trail
aws cloudtrail create-trail \
  --name lab-07-management-trail \
  --s3-bucket-name <bucket> \
  --is-multi-region-trail \
  --include-global-service-events

aws cloudtrail start-logging --name lab-07-management-trail
```

### Verified audit visibility

Confirmed that my own KMS Encrypt and Decrypt operations from Lab 7a appeared in CloudTrail Event History (visible in console). Each event included:
- Event time
- Event name (Encrypt, Decrypt)
- User identity (`tyanick-admin`)
- Source IP address
- Request parameters and response elements

This is the audit trail: every API call, who made it, when, from where, with what result.

### CloudTrail vs CloudWatch (exam-relevant)

| | CloudTrail | CloudWatch |
|---|---|---|
| Purpose | **Audit** — who did what API call | **Monitoring** — performance metrics |
| Example | "tyanick-admin terminated EC2 i-xxx at 14:35" | "EC2 hit 80% CPU at 14:30" |
| Source | API call logs | Resource metrics |
| Default retention | 90 days in Event History; longer if trail configured | 15 months metric storage |

## Production lessons surfaced

1. **`get-key-rotation-status` requires KeyId, not alias.** Some KMS operations accept aliases as identifiers; some require KeyIds. This is a real gotcha. Lock in: *aliases are human-friendly labels, KeyIds are canonical.*

2. **CloudTrail S3 delivery is asynchronous.** Event History shows events in ~15 minutes, but trail-to-S3 delivery can take 5-15 minutes for the first batch. The trail is still working; logs are just queued for delivery. If events appear in console Event History, audit is working — S3 delivery is just batched.

3. **Key administrators ≠ key users in production.** The default key policy creates two separate permission statements. Key administrators manage the key (rotate, delete) but cannot use it for encrypt/decrypt. Key users have encrypt/decrypt permission but cannot manage the key. Separation of duties prevents a single compromised user from both encrypting fraudulent data AND covering their tracks.

4. **KMS deletion has a 7-30 day safety window.** Data encrypted with a deleted key is permanently unrecoverable. AWS forces a waiting period during which deletion can be canceled.

## Resources used

- 1 customer-managed KMS key (scheduled for deletion at end of lab — pending 7-day window)
- 1 CloudTrail trail (deleted)
- 1 S3 bucket for trail logs (emptied + deleted)
- Tiny encrypted test file (deleted locally)

## Cost summary

| Resource | Cost rate | Lab duration | Estimated cost |
|----------|-----------|--------------|----------------|
| KMS CMK | $1/month per key | <1 day active | <$0.04 |
| KMS API calls (encrypt/decrypt) | $0.03 per 10,000 requests | ~10 calls | <$0.001 |
| CloudTrail (first trail, management events) | Free | All session | $0 |
| S3 storage for trail logs | $0.023/GB/month | <1 day | <$0.001 |
| **Total** | | | **~$0.05** |

## What I'd add for production

1. **Dedicated key administrators separate from key users** — Bob administers the key (rotation, policy changes); Alice uses it for data access. Compromise of one doesn't compromise the other.
2. **Multi-region CMK** — keys can be replicated to other regions for DR scenarios. Adds resilience for multi-region applications.
3. **KMS deletion protection via SCP** — at the organization level, an SCP can prevent KMS key deletion entirely. Belt and suspenders.
4. **CloudTrail Insights** — enables anomaly detection on API activity patterns. Optional cost (~$0.35/100k events), but real value for security operations.
5. **CloudTrail S3 lifecycle to Glacier** — trail logs go to S3 Standard; after 90 days, transition to Glacier for long-term compliance archive. Cost reduction.
6. **CloudWatch Logs integration** — also send trail events to CloudWatch Logs for real-time alerting on critical actions (e.g., alert if root user logs in).
7. **Per-service key aliases** — instead of one `lab-07-key`, have `alias/rds-prod-data`, `alias/s3-customer-pii`, etc. Cleaner, easier to audit which key encrypts what.

## Cleanup verification

```bash
# Confirmed CloudTrail bucket deleted
aws s3 ls | grep cloudtrail  # returns nothing

# Confirmed CloudTrail trail deleted
aws cloudtrail describe-trails  # returns empty trailList

# Confirmed KMS key in PendingDeletion state
aws kms describe-key --key-id <id> --query "KeyMetadata.KeyState"  # "PendingDeletion"
```

KMS key will be permanently deleted in 7 days. Until then, it remains charged at $1/month rate. To cancel deletion (e.g., if I need to decrypt old data):

```bash
aws kms cancel-key-deletion --key-id <id>
aws kms enable-key --key-id <id>
```

