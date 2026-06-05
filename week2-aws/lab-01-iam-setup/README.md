# AWS Lab 01 — IAM User and CLI Setup

Created a proper IAM admin user for daily AWS work, generated CLI access keys, installed AWS CLI v2 in WSL, and locked down the root account.

## What it demonstrates

- **Principle of least privilege as a starting habit** — never use root for daily operations
- **IAM user provisioning via Console** — including Console access + CLI access keys
- **AWS CLI v2 installation on WSL Ubuntu** — proper command-line setup for ongoing labs
- **Root account hardening** — MFA enabled, no access keys, IAM dashboard checks passed
- **Cross-channel verification** — proving CLI auth works via `aws sts get-caller-identity`

## Setup steps

1. Created IAM user `yanick-admin` with `AdministratorAccess` policy
2. Generated CLI access keys, saved to local .csv (not committed)
3. Installed AWS CLI v2 in WSL Ubuntu via official install script
4. Configured CLI with `aws configure` (region: us-east-1, output: json)
5. Verified with `aws sts get-caller-identity`, `aws s3 ls`, `aws iam list-users`
6. Signed out of root, signed back in as IAM user, set new password
7. Confirmed root account has MFA enabled and no active access keys

## CLI verification

```bash
$ aws sts get-caller-identity
{
    "UserId": "...",
    "Account": "...",
    "Arn": "arn:aws:iam::...:user/yanick-admin"
}
```

## Key learnings

- The root account is for billing/account-level emergencies only — never daily work
- Access keys appear once and only once; lose them and you regenerate, not recover
- The CLI is now configured for `us-east-1` to match the cost-discipline region we picked Day 5
- IAM is the foundation of *everything* in AWS — every service uses it for permissions
