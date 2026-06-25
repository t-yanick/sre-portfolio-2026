# AWS Lab 05 — EFS Shared Storage (Incomplete — SG Diagnostic Blocker)

Attempted to demonstrate EFS as a shared filesystem across two EC2 instances in different AZs. The mount timed out due to a security group misconfiguration; a power outage prevented completion. Resources were cleaned up to avoid drift. Documenting this lab as a real-world "what I attempted, what failed, what I learned" portfolio piece.

## What I attempted

- 2 EC2 instances launched: `lab-05-ec2-az-a` (us-east-1a) and `lab-05-ec2-az-b` (us-east-1b)
- 1 EFS filesystem `lab-05-shared-efs` with mount targets in both AZs
- Two security groups: `lab-05-ec2-sg` (SSH from anywhere) and `lab-05-efs-sg` (NFS port 2049 from VPC CIDR)
- Plan: SSH into both instances, mount EFS, write a file from one, read it from the other to prove shared access

## What happened

```bash
$ sudo mount -t efs fs-0a015c142b6bc2fe2:/ /mnt/efs
Mount attempt 1/3 failed due to timeout after 15 sec, wait 0 sec before next attempt.
Mount attempt 2/3 failed due to timeout after 15 sec, wait 0 sec before next attempt.
b'mount.nfs4: mount system call failed'
```

Mount timed out with NFS connection failure. The instance had network access (could ping internet), the EFS filesystem was Available, but NFS port 2049 wasn't reaching the mount targets.

## What I learned (without completing the lab)

- **EFS mount targets need their own security group with port 2049 (NFS) explicitly open.** The default VPC's SG is not sufficient.
- **The mount helper times out gracefully but does not diagnose SG issues automatically.** Manual investigation is required — check the EFS mount target's actual SG attachment via `aws efs describe-mount-target-security-groups`.
- **EFS connectivity has three independent layers** that all must align:
  1. EFS filesystem state (Available)
  2. Mount target SG (allows NFS from EC2 SG or VPC CIDR)
  3. EC2 SG (allows outbound NFS — usually default outbound covers this)
- **Production debugging order for EFS mount failures:**
  1. Verify mount target is `Available` in the EC2's AZ
  2. Check the SG attached to that mount target
  3. Verify the SG allows port 2049 from the EC2's SG or VPC CIDR
  4. Check EC2's outbound rules permit NFS (default usually does)
  5. If all clear, check route tables — EFS mount targets must be reachable from the subnet

## What I would do differently next time

1. **Explicitly verify the mount target's SG attachment** with the CLI before attempting to mount:
```bash
   aws efs describe-mount-targets --file-system-id <fs-id>
   aws efs describe-mount-target-security-groups --mount-target-id <mt-id>
```
2. **Allow NFS from the EC2 instance's SG specifically** (more precise than VPC CIDR — principle of least privilege).
3. **Test connectivity before mounting** with `nc -zv <mount-target-ip> 2049` to isolate network layer issues from EFS issues.

## Status

- All resources cleaned up: ✅ EC2 instances terminated, EFS filesystem deleted, mount targets deleted, SGs deleted
- This lab will be revisited in a future session with the corrected security group configuration

## Why this is in the portfolio

Real engineering work includes failures. Documenting *what was attempted, what failed, and what was learned* is more credible than a portfolio of only-successful labs. The EFS-specific gotcha (mount target SG must allow NFS from EC2 SG) is a real production failure mode and worth knowing.

