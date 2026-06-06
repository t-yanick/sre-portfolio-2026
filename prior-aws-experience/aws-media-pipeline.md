# Prior AWS + Terraform Work — Serverless Media Pipeline Scaffold (April 2026)

## Context

In April 2026, while doing a Terraform deep-dive on Pluralsight, I built the Terraform code for an AWS serverless architecture: an S3-triggered Lambda pipeline scaffolded for downstream AI media processing. The S3 layer was applied to my AWS account in `ca-central-1` (Canada Central); the Lambda layer and supporting infrastructure were committed in code but never applied.

**Repo:** https://github.com/t-yanick/aws-media-pipeline-infra/tree/setup-base-infra
**Branch with the active work:** `setup-base-infra` (2 commits ahead of `master`)
**Region:** `ca-central-1`

## Intended architecture
S3 Bucket
(uploads)
|
v  [S3 event notification]
Lambda (Python)
|
v
CloudWatch Logs +
downstream AI processing hook
## What is actually deployed to AWS

Verified June 2026 via CLI inventory of `ca-central-1`:

- **S3 bucket** — `aws-media-pipeline-uploads-2a9f7037` — successfully provisioned via Terraform and still live
- **`terraform-admin` IAM user** — created (with `AdministratorAccess`) to drive the Terraform runs; access key now rotated to `Inactive`

## What exists in code but was not applied

- **Lambda function** (`src/index.py`) — Python handler that extracts bucket + object key from S3 events, logs to CloudWatch, returns a JSON API response, and is positioned as the trigger point for downstream AI processing
- **Lambda IAM execution roles** — defined in Terraform but never applied
- **S3 event notification → Lambda wiring** — defined in Terraform but never applied
- **Remote state backend with locking** — referenced in the design but not provisioned (no DynamoDB lock table exists in the account)

## Terraform discipline shown in the repo

- **Modular file structure** — `main.tf`, `variables.tf`, `outputs.tf`, `providers.tf` separated by concern
- **Version locking** — `.terraform.lock.hcl` committed (ensures reproducible builds across collaborators)
- **Feature-branch workflow** — work isolated on `setup-base-infra` branch rather than pushed directly to `master`
- **Meaningful commit messages** — each commit describes a discrete unit of work ("Initial S3 infrastructure with terraform" → "Hook up a python Lambda to trigger AI processing")
- **Open-source ready** — MIT licensed, `.gitignore` in place

## What this work taught me

- The Terraform workflow at the file-organization level: `main.tf`, `variables.tf`, `providers.tf`, `outputs.tf` as separated concerns
- Provider configuration and AWS authentication via IAM access keys
- The `terraform init` → `plan` → `apply` cycle, and the operational consequences of stopping mid-cycle
- Event-driven serverless architecture as a *design pattern* — S3 → Lambda → CloudWatch
- The reality of partially-applied infrastructure: real cloud state and live IAM credentials persist long after the project sits idle

## What I cleaned up in June 2026

When I resumed serious AWS work in June 2026 (Week 2 of my SRE pivot), I:

- Inventoried the account state across regions with the AWS CLI:
  - `aws s3api list-buckets`
  - `aws lambda list-functions --region ca-central-1`
  - `aws iam list-users`
  - `aws iam list-access-keys --user-name terraform-admin`
  - `aws dynamodb list-tables --region ca-central-1`
- Confirmed only the S3 layer of the planned architecture had been applied to AWS
- **Rotated the dormant `terraform-admin` access key** by setting it to `Inactive` — credential hygiene practice
- Verified $0.00 month-to-date spend, $100 free-tier credit still intact

## Pending cleanup

- The S3 bucket and `terraform-admin` user will be properly destroyed via `terraform destroy` (or manual cleanup) in Week 7 of the SRE pivot (Terraform Associate prep)
- The repo will be revisited and refactored with current best practices before it's featured as a Week 7 portfolio piece

## Why this matters for my SRE pivot

This work gives me a real Terraform + AWS head start before I officially reach the Terraform module in my 5-month plan (Weeks 7-9). The fact that the apply was incomplete is itself useful context — it taught me first-hand how unfinished IaC leaves real cloud state behind, which is exactly the kind of operational pitfall an SRE needs to recognize and remediate.

