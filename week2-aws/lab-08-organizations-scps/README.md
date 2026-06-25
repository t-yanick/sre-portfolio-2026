# AWS Lab 08 — Organizations and Service Control Policies (SCPs)

Created an AWS Organization, an Organizational Unit, and a custom Service Control Policy demonstrating the multi-account governance pattern that AWS enterprises use to restrict actions across hundreds of accounts. The SCP enforces a "no-expensive-EC2-instances" guardrail that even root users in member accounts cannot override.

## What it demonstrates

- **AWS Organizations setup** — converting a standalone account into the management account of a new organization
- **Organizational Units (OUs)** — the hierarchical structure for grouping accounts under common governance
- **Service Control Policies (SCPs)** — guardrails that limit actions across accounts, regardless of IAM policies in those accounts
- **The IAM grant model vs the SCP deny model** — IAM policies grant permissions to users; SCPs constrain what permissions can ever be granted in the member accounts
- **Policy intersection logic** — SCPs combine with the default `FullAWSAccess` policy by intersection; deny in any SCP wins, even if IAM grants admin permissions
- **SCP attachment scope** — SCPs apply to all members of the attached OU, including root users (the *only* mechanism that constrains root)

## Architecture
Organization (o-ljl2mn1acu)
                      |
              Root (r-y1po)
                      |
          +-----------+-----------+
          |                       |
    Management Account     OU "RestrictedTesting" (ou-y1po-fc10yyog)
    (097690245019)         |
                             (empty for this lab)
                              |
                              v
                      Attached SCPs:
                      - FullAWSAccess (AWS-managed default)
                      - lab-08-deny-expensive-instances (custom)
## Setup steps

1. Created organization with `ALL` features enabled (required for SCPs)
2. Created OU `RestrictedTesting` under organization root
3. Enabled the SCP policy type (separate from "all features" enablement)
4. Created custom SCP `lab-08-deny-expensive-instances` denying `ec2:RunInstances` for any instance type not in the allowed list
5. Attached SCP to the `RestrictedTesting` OU
6. Verified attachment — two SCPs attached: `FullAWSAccess` + the custom deny policy

## The SCP used

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "DenyExpensiveInstanceTypes",
            "Effect": "Deny",
            "Action": "ec2:RunInstances",
            "Resource": "arn:aws:ec2:*:*:instance/*",
            "Condition": {
                "ForAnyValue:StringNotEquals": {
                    "ec2:InstanceType": [
                        "t2.micro",
                        "t2.small",
                        "t3.micro",
                        "t3.small",
                        "t3.medium"
                    ]
                }
            }
        }
    ]
}
```

Plain English: *"In any account in this OU, no one can launch an EC2 instance unless its type is t2/t3 micro, small, or medium. Not even root."*

## The mental model — IAM vs SCP

| | IAM Policy | Service Control Policy (SCP) |
|---|---|---|
| Scope | User/role/group within an account | OU, account, or organization root |
| Purpose | **Grant** permissions | **Constrain** what permissions can be granted |
| Default behavior | Deny (explicit grant required) | Allow (explicit deny required, via `FullAWSAccess` default) |
| Override-able by admin? | Yes — admins can modify IAM in their own account | No — SCPs come from the management account |
| Applies to root? | Yes (root has all permissions by default) | Yes (root cannot escape SCPs in member accounts) |

The interaction model: **a user's effective permissions = IAM grants ∩ SCP allows**. Both layers must permit the action; deny in either layer blocks it.

## Why SCPs matter — production pattern

This is the multi-account governance pattern Fortune 500 companies use:

1. Create an Organization with the production account as the management account
2. Create OUs by environment: `Production`, `Staging`, `Development`, `Sandbox`
3. Apply tightening SCPs as you move toward higher-risk environments:
   - Sandbox: deny resource creation in expensive regions (no us-east-1 if you're EU-based)
   - Development: deny production-sized instances (the pattern this lab demonstrated)
   - Staging: deny IAM policy changes
   - Production: deny everything except via approved CI/CD roles
4. Even when developers are granted `AdministratorAccess` in their dev accounts, they cannot escape the SCP guardrails

This is the *only* mechanism in AWS that constrains what root users can do in member accounts.

## Exam pattern questions

> *"A company wants to prevent dev accounts from creating EC2 instances larger than t3.medium, even if developers have admin access. What's the best mechanism?"*

Answer: **SCP applied to the development OU.**

NOT: IAM policy in the dev accounts (developers with admin can modify IAM).
NOT: Tag-based restrictions (require enforcement at the API level).
NOT: AWS Config rules (these detect non-compliance after the fact, don't prevent it).

> *"Can SCPs be used to grant permissions to users in member accounts?"*

Answer: **No.** SCPs only constrain. Users must still have IAM permissions granted by an IAM policy in their account. SCPs define the *maximum* set of permissions IAM can grant.

## Resources used

- 1 Organization (o-ljl2mn1acu) — left in place after lab (free)
- 1 Organizational Unit (ou-y1po-fc10yyog) — deleted
- 1 custom SCP (p-ktdxbjkd) — deleted

## Cost summary

| Resource | Cost | Total |
|----------|------|-------|
| AWS Organizations | Free | $0 |
| OUs | Free | $0 |
| SCPs | Free | $0 |
| **Total** | | **$0** |

## Cleanup verification

```bash
# OU deleted
aws organizations list-organizational-units-for-parent --parent-id r-y1po --output table
# Returns: empty

# SCP deleted
aws organizations list-policies --filter SERVICE_CONTROL_POLICY \
  --query "Policies[?Name=='lab-08-deny-expensive-instances']" --output table
# Returns: empty
```

**Note:** The Organization itself was left in place. Dissolving an organization requires removing all member accounts (only the management account remained) AND has documented friction with AWS support. The organization is free to maintain and provides infrastructure for future multi-account labs.

## What I'd add for production

1. **Multiple OUs by environment** — Production, Staging, Development, Sandbox, each with progressively tighter SCPs
2. **AWS Control Tower** — automated landing zone setup that creates a multi-account governance baseline (best practices baked in)
3. **Centralized logging account** — all CloudTrail logs from member accounts deliver to a dedicated audit account
4. **SCP guardrails by category:**
   - Region restrictions (deny operations outside approved regions for compliance)
   - Required tagging (deny resource creation without specific tags)
   - Service-level restrictions (e.g., dev accounts cannot use SageMaker)
   - Cost guardrails (the pattern demonstrated)
5. **Permission boundaries** — IAM-level constraint that pairs with SCPs for in-account guardrails
6. **Cross-account IAM roles** with `aws:PrincipalOrgID` condition — only allow assume-role from within your organization

