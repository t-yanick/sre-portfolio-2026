# AWS Lab 02 — IAM Groups, Policies, and Role Assumption

Implemented a realistic small-org IAM pattern: a Developers group with a scoped policy, a test user in that group, and a separate role with stricter permissions that the user temporarily assumes.

## What it demonstrates

- **Principle of least privilege at the group level** — Developers group has only `AmazonS3ReadOnlyAccess`
- **Trust policies (WHO) vs permission policies (WHAT)** — the trust policy on `ReadOnlyEC2Role` restricts assumption to a specific user ARN
- **Role assumption replaces user permissions** — when `dev-test-user` assumes `ReadOnlyEC2Role`, EC2 read works but S3 read is no longer available
- **Console-based "Switch role" workflow** — the daily pattern for temporary privilege elevation
- **Documented user/group/role separation** — three distinct IAM primitives, each used correctly

## Setup

1. Created group `Developers` with `AmazonS3ReadOnlyAccess`
2. Created user `dev-test-user`, added to `Developers` group
3. Created role `ReadOnlyEC2Role` with `AmazonEC2ReadOnlyAccess`
4. Locked the role's trust policy to allow only `dev-test-user` to assume it
5. Signed in as `dev-test-user`, verified S3 access works, EC2 access denied
6. Switched role to `ReadOnlyEC2Role`, verified EC2 access works, S3 access changed

## The mental model that locked this in

- **User** = an identity (who you are)
- **Group** = a bucket of users with shared permissions
- **Role** = a temporary identity that users (or services) can assume
- **Trust policy** = who can assume this role
- **Permission policy** = what this role can do

## Why this maps to the SAA-C03 exam

Role assumption is heavily tested. The classic exam question pattern:

> An application running on EC2 needs to access S3. What's the best practice?

Wrong answer: store IAM access keys on the EC2 instance.
Right answer: create a role with S3 access, attach it to the EC2 instance via an instance profile, EC2 assumes the role automatically.

This lab demonstrates the human-side equivalent — a user assuming a role via Switch Role. The mechanics are the same.

## Cleanup

The user, group, and role created here are kept for ongoing practice during Week 2. They'll be cleaned up via `terraform destroy` (or manual deletion) in Week 7.
