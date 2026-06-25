# AWS Lab 01 — IAM User and CLI Setup

Created a proper IAM admin user for daily AWS work, generated CLI access keys, installed AWS CLI v2 in WSL, audited an inherited account state, and locked down dormant credentials.

## What it demonstrates

- **Principle of least privilege as a starting habit** — never use root for daily operations
- **IAM user provisioning via Console** — including Console access + CLI access keys + Admin policy attached
- **AWS CLI v2 installation on WSL Ubuntu** — current version 2.32.16
- **Root account hardening** — MFA enabled, IAM-user billing access toggled on
- **Audit-then-act discipline** — inventoried existing account state before adding new resources
- **Credential rotation** — deactivated a dormant Terraform admin key from prior infrastructure work

## Setup steps

1. Created IAM user `tyanick-admin` with `AdministratorAccess` policy
2. Generated CLI access keys, downloaded to local .csv (never committed)
3. Installed AWS CLI v2 in WSL Ubuntu (v2.32.16) via official install script
4. Configured CLI with `aws configure` (region: us-east-1, output: json)
5. Verified with `aws sts get-caller-identity`, `aws s3 ls`, `aws iam list-users`
6. Audited account state — discovered prior `terraform-admin` user from April 2026 Terraform exploration
7. Deactivated dormant `terraform-admin` access key as a security hygiene measure
8. Enabled IAM-user access to billing pages (one-time root toggle)
9. Verified $0.00 month-to-date spend; $100 credit intact

## Verifying CLI identity

```bash
$ aws sts get-caller-identity
{
    "UserId": "AIDARNPWK26NU6PEYNHR2",
    "Account": "097690245019",
    "Arn": "arn:aws:iam::097690245019:user/tyanick-admin"
}
```

## Key learnings

- The root account is for billing and account-level emergencies only — never daily work
- Access keys appear once and only once; lose them and you regenerate, not recover
- Even with `AdministratorAccess`, IAM users cannot access billing pages by default — root must toggle "IAM access to billing"
- **Audit before adding.** A new AWS account is rarely truly new — inventory existing resources before creating more
- Dormant credentials are a real risk; rotate them by deactivating rather than waiting to find them in a breach

## Open follow-ups (in cleanup-tasks.md)

- Delete the `terraform-admin` IAM user once we confirm no future use
- Clean up the orphaned S3 bucket from the April Terraform run (see `prior-aws-experience/aws-media-pipeline.md`)
