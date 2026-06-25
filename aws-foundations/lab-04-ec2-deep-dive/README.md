# AWS Lab 04 — EC2 Deep Dive

Launched two EC2 instances (Amazon Linux 2023 and Ubuntu 26.04), demonstrated user data execution, IMDSv1 vs IMDSv2 behavior with a real silent-failure diagnostic, attached and persisted data through an EBS volume, observed stop/start behavior, and tore everything down with verified clean state.

## What it demonstrates

- **AMI choice determines OS-level defaults** — login user (`ec2-user` vs `ubuntu`), package manager (`yum`/`dnf` vs `apt`), default filesystem, AMI ID
- **User data scripts** as a deployment automation pattern — instance configures itself on first boot
- **IMDSv1 vs IMDSv2 security distinction** — a real silent-failure diagnostic that mirrors production debugging
- **EBS persistence** across instance stop/start — block storage outlives compute
- **EBS "Delete on termination" trade-off** — what survives instance termination, and the orphan-volume cost trap
- **fstab gotcha** — manual mounting doesn't survive reboot without fstab; tested and confirmed in this lab
- **Stop vs Terminate distinction** — both EBS volumes survive stop; public IP changes; only "Delete on termination = Yes" volumes die at terminate
- **Cost-discipline cleanup** — terminate instances, delete orphaned volumes, delete snapshots, verify clean via CLI

## Architecture
Internet (browser, SSH)

|

v

[ IGW ] (default VPC)

|

+---v-------------------------------------------------+

| Default VPC: 172.31.0.0/16                          |

|                                                      |

|  Public subnet (us-east-1c)                         |

|  +-----------------------------------+              |

|  | EC2: lab-04-amazon-linux          |              |

|  |   - t3.micro, AL2023, IMDSv2-only |              |

|  |   - Root EBS: 8GB (auto-delete)   |              |

|  |   - Data EBS: 5GB (no-auto-delete)|              |

|  |   - User data: installs Apache    |              |

|  +-----------------------------------+              |

|                                                      |

|  Different subnet                                   |

|  +-----------------------------------+              |

|  | EC2: lab-04-ubuntu                |              |

|  |   - t3.micro, Ubuntu 26.04        |              |

|  |   - Root EBS: 8GB (auto-delete)   |              |

|  +-----------------------------------+              |

+------------------------------------------------------+
## Resources created (and destroyed)

| Resource | Name | Notes |
|----------|------|-------|
| Security Group | `lab-04-web-sg` | Inbound SSH + HTTP from 0.0.0.0/0 |
| Key pair | `lab-03-keypair` | Reused from Lab 03 |
| EC2 instance 1 | `lab-04-amazon-linux` | t3.micro, AL2023, with 5GB additional EBS data volume |
| EC2 instance 2 | `lab-04-ubuntu` | t3.micro, Ubuntu 26.04 LTS |
| EBS snapshot | `lab-04-data-volume-test-snapshot` | Of the 5GB data volume after writing test data |

All resources destroyed at end of lab. CLI-verified zero remaining cost-bearing resources.

## The IMDSv1 → IMDSv2 diagnostic — observed behavior

This was the most instructive moment of the lab.

### Setup
The user data script used IMDSv1 syntax to query metadata for the welcome web page:

```bash
echo "Instance type: $(curl -s http://169.254.169.254/latest/meta-data/instance-type)"
```

### Observed failure
The Apache page rendered, the hostname appeared, but the instance-type and availability-zone fields were **empty**.

### Diagnosis from inside the instance

```bash
$ curl -v http://169.254.169.254/latest/meta-data/instance-type
< HTTP/1.1 401 Unauthorized
```

The Amazon Linux 2023 AMI defaults to **IMDSv2-only** — the older IMDSv1 protocol returns 401 Unauthorized.

### IMDSv2 fix

```bash
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-type
# Returns: t3.micro
```

IMDSv2 requires a **session token** obtained via PUT, then used as a header in subsequent GETs.

### Why this matters

IMDSv1 vulnerability to SSRF attacks led AWS to introduce IMDSv2 in 2019 and default new AMIs to v2-only. The exam tests this pattern:

> "An EC2 instance was compromised through SSRF and IAM credentials were stolen from metadata service. Which feature prevents this?"

Answer: **Enforce IMDSv2.**

## EBS persistence — observed behavior

### Test 1 — Stop the instance, then start it
- Stopped `lab-04-amazon-linux` (state: `Running → Stopped`)
- Public IP changed from `54.234.237.114` to `54.159.26.103` (IPs don't persist across stop/start without Elastic IP)
- After start: data volume still attached, file `/data/test.txt` still readable with original timestamp
- **EBS persistence confirmed** — data outlived the underlying VM

### Test 2 — Terminate the instance
- Root volume (Delete on termination = Yes): destroyed
- Data volume (Delete on termination = No): survived as detached, **"orphan"** volume
- Required manual `aws ec2 delete-volume` to remove

This is the production cost trap. A team terminates instances; volumes with `Delete on termination = No` accumulate as orphans. Verified clean via:

```bash
aws ec2 describe-volumes --query "Volumes[].[VolumeId,State,Size]" --output table
```

## fstab gotcha — observed behavior

Manually mounted `/dev/nvme1n1 → /data` before the stop/start test. After restart:

```bash
$ df -h | grep nvme1n1
(no output — volume not mounted)

$ cat /etc/fstab
UUID=3711a4fe-...     /          xfs    defaults,noatime  1   1
UUID=4176-04F8        /boot/efi  vfat   defaults,...      0 2
```

**The fstab append from the original setup step never wrote.** Manual mount succeeded but did not persist.

In production this is a real 2 AM incident pattern:
- Instance auto-recovers or is rebooted by AWS maintenance
- Volume detaches and reattaches but `/data` is no longer mounted
- Applications fail with file-not-found errors
- Engineer wakes up to confusing on-call page

The correct command to make the mount survive reboot:

```bash
sudo bash -c 'echo "/dev/nvme1n1 /data xfs defaults,nofail 0 2" >> /etc/fstab'
```

The `nofail` option is critical — it tells the OS to continue booting even if the volume can't be mounted, preventing the entire instance from failing to boot.

## AMI choice = OS defaults

| | Amazon Linux 2023 | Ubuntu 26.04 LTS |
|---|---|---|
| AMI ID | (separate ID) | `ami-0b6d9d3d33ba97d99` |
| Login user | `ec2-user` | `ubuntu` |
| Package manager | `dnf` (yum compatible) | `apt` |
| Default filesystem | XFS | ext4 |
| IMDS default | v2-only | v2-only |

The IMDSv2 protocol is **identical across OSes** — same token endpoint, same header pattern. This confirms IMDS is part of the AWS infrastructure layer, not the OS.

## Production debugging order for "instance unreachable"

Building on Lab 03's framework:

1. **Instance state** — is it Running? (cheapest check)
2. **Security Group** — does inbound rule allow the protocol/port from the source?
3. **NACL** — does subnet-level firewall allow both directions?
4. **Route Table** — does the subnet route to IGW (public) or NAT GW (private)?
5. **OS-level** — is the service (Apache, SSH, etc.) actually running?
6. **User data execution** — check `/var/log/cloud-init-output.log` for boot-time errors

## Stop vs Terminate — exam-relevant distinctions

| | Stop | Terminate |
|---|---|---|
| Instance ID | Preserved | Destroyed forever |
| EBS root volume | Preserved | Destroyed (default) |
| Public IP | Released | Released |
| Elastic IP | Preserved if attached | Preserved (becomes detached) |
| Compute billing | Stops | Stops |
| EBS billing | Continues | Continues for volumes with Delete-on-termination = No |
| Can be restarted | Yes | No (have to launch new instance) |

## Cost summary

| Resource | Hourly cost | Lab duration | Estimated cost |
|----------|-------------|--------------|----------------|
| 2x t3.micro EC2 | Free tier | ~2h | $0 |
| 8GB root EBS x2 | Free tier | ~2h | $0 |
| 5GB additional EBS | $0.08/GB/month | ~2h | <$0.001 |
| EBS snapshot 5GB | $0.05/GB/month | ~30min | <$0.001 |
| **Total** | | | **~$0.00** |

## Cleanup verification

All four CLI inventories returned empty:

```bash
aws ec2 describe-instances --query "Reservations[].Instances[?State.Name!='terminated']" 
aws ec2 describe-volumes 
aws ec2 describe-snapshots --owner-ids self 
aws ec2 describe-security-groups --query "SecurityGroups[?GroupName=='lab-04-web-sg']"
```

Zero remaining cost-bearing resources.

## What I'd change for production

1. **IMDSv1 disabled at account level** via AWS Organizations SCP — prevents new instances from accepting v1 even by user choice
2. **fstab + UUID-based mounting** — use UUIDs rather than device paths (which can change between reboots on NVMe instances)
3. **Tag-based automation** — every resource tagged with Environment, Project, Owner; automated nightly orphan-volume cleanup via Lambda
4. **CloudWatch alarms** on EBS volume orphaning events
5. **Restrict SSH source CIDR** to bastion host or company VPN, not 0.0.0.0/0
6. **HTTPS-only Apache** with ACM-managed certificate, not plain HTTP
7. **Instance role (IAM)** instead of user-data secrets if app needs AWS access
