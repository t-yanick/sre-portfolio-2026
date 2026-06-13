# AWS Lab 03 — Build a VPC from Scratch

Built a 2-subnet VPC in `us-east-1` with public/private routing, ran a hands-on Security Group vs NACL drill to internalize the stateful/stateless distinction, then destroyed all resources to control cost.

## What it demonstrates

- **VPC fundamentals from scratch** — VPC creation, CIDR planning, subnet design, IGW, NAT GW, route tables, subnet associations
- **Public vs private subnet mechanics** — same VPC, different route tables: one with `0.0.0.0/0 -> IGW` (public), one with `0.0.0.0/0 -> NAT GW` (private)
- **Cross-AZ subnet placement** — public in `us-east-1a`, private in `us-east-1b`, matching the production multi-AZ pattern at the routing level
- **Security Group vs NACL behavioral difference** — hands-on drill proving stateful (SG) vs stateless (NACL) connection tracking
- **Production debugging order** — Security Group → NACL → Route Table, instance-outward
- **Cost-conscious resource teardown** — terminate compute first, delete NAT GW (stops cost clock), release Elastic IP (avoids idle-EIP charges)

## Architecture built
Internet (laptop SSH)

|

v

+---+---------+

|    IGW      |

+---+---------+

|

+------v---------------------------------------------------+

| VPC: 10.0.0.0/16   "lab-03-vpc"                          |

|                                                           |

|  us-east-1a                  us-east-1b                  |

|  +-------------------+       +-------------------+       |

|  | Public Subnet     |       | Private Subnet    |       |

|  | 10.0.1.0/24       |       | 10.0.2.0/24       |       |

|  | Route: -> IGW     |       | Route: -> NAT GW  |       |

|  |                   |       |                   |       |

|  | [ NAT GW ]        |       |                   |       |

|  | [ EC2 t2.micro ]  |       |                   |       |

|  | NACL + SG layers  |       |                   |       |

|  +-------------------+       +-------------------+       |

+-----------------------------------------------------------+
## Resources created

| Resource | Name | Notes |
|----------|------|-------|
| VPC | `lab-03-vpc` | CIDR `10.0.0.0/16` |
| Public subnet | `lab-03-public-subnet` | `10.0.1.0/24`, `us-east-1a` |
| Private subnet | `lab-03-private-subnet` | `10.0.2.0/24`, `us-east-1b` |
| Internet Gateway | `lab-03-igw` | Attached to VPC |
| NAT Gateway | `lab-03-nat-gw` | In public subnet, Elastic IP attached |
| Public Route Table | `lab-03-public-rt` | `0.0.0.0/0 -> IGW`, associated to public subnet |
| Private Route Table | `lab-03-private-rt` | `0.0.0.0/0 -> NAT GW`, associated to private subnet |
| NACL | `lab-03-public-nacl` | Inbound SSH allow, Outbound `1024-65535` allow, on public subnet |
| Security Group | `lab-03-web-sg` | Inbound SSH from anywhere, default outbound |
| EC2 instance | `lab-03-web-instance` | `t2.micro`, Amazon Linux 2023, in public subnet |
| Key pair | `lab-03-keypair` | RSA, `.pem` stored at `~/.aws/keys/lab-03-keypair.pem` mode 0400 |

## The Security Group vs NACL drill — observed behavior

The lab's centerpiece. Two firewalls, identical-looking inbound rules, intentionally different outbound configurations.

### Test 1 — Baseline
- NACL: inbound SSH allow, outbound `1024-65535` allow
- SG: inbound SSH allow, outbound `all traffic` allow
- **Result:** SSH connects successfully

### Test 2 — Break the NACL outbound rule
- Deleted the `1024-65535` outbound rule from NACL
- SG outbound unchanged
- **Result:** SSH times out (`Connection timed out`)
- **Why:** NACL is stateless. Inbound request passes (allowed). EC2 reply hits NACL outbound layer with no matching rule. Reply dropped. Laptop waits, then times out.

### Test 3 — Restore NACL, break the Security Group outbound rule
- NACL restored to baseline
- Deleted *all* outbound rules from SG
- **Result:** SSH still connects successfully
- **Why:** SG is stateful. The SG remembers the inbound SSH connection and auto-allows return traffic, regardless of whether an explicit outbound rule exists.

### Mental model locked in

| | Security Group | NACL |
|---|---|---|
| Layer | Instance/ENI | Subnet |
| State | **Stateful** (remembers connections) | **Stateless** (each direction evaluated independently) |
| Default outbound | Allows all | Denies all |
| Return traffic | Auto-allowed | Requires explicit rule |
| Rule eval order | All rules evaluated, deny is implicit | Rules evaluated in numbered order |

### Production debugging order

When "SSH stopped working" on an EC2 instance, check in this order — closest-to-instance outward:

1. **Security Group** — instance-level firewall, fastest to verify
2. **NACL** — subnet-level firewall, slightly broader scope
3. **Route Table** — network-level, requires understanding entire VPC topology

## Design decisions

### Why single-AZ subnets for this lab (vs. true multi-AZ)

This lab uses one public subnet in `us-east-1a` and one private subnet in `us-east-1b`. That's enough to demonstrate:
- The mechanical difference between public and private subnets (route tables, not IP ranges)
- Cross-AZ subnet placement matching production patterns
- All the firewall, routing, and connectivity concepts the SAA-C03 exam tests

A true production VPC would have **two of each tier** — one per AZ — for full multi-AZ resilience. The same-tier subnets in different AZs eliminate single-AZ failure as a risk. With our 2-subnet design, an `us-east-1a` outage takes the public layer down (and with it, the NAT GW); an `us-east-1b` outage takes the private layer down.

### NAT Gateway placement and cost trade-off

The lab provisions one NAT GW in the public subnet (`us-east-1a`) to serve outbound traffic from the private subnet in `us-east-1b`. This mirrors the cost-conscious pattern many small companies use in production: one NAT GW for the whole VPC.

**Trade-off:** the NAT GW becomes a single point of failure across both AZs. If `us-east-1a` (NAT GW's AZ) goes down, the private subnet in `us-east-1b` loses internet egress even though that AZ itself is healthy.

**Full production pattern:** one NAT GW per AZ (~$0.09/hour total vs $0.045/hour). The cost roughly doubles, but private subnets remain functional during single-AZ outages.

## What I'd change for production

1. **Two NAT Gateways**, one in each AZ's public subnet, with each private subnet routing to its same-AZ NAT GW. Eliminates the single-AZ NAT GW failure mode.
2. **Four subnets total** — public + private in each AZ — for full tier-level redundancy.
3. **Tighten SSH source** — `0.0.0.0/0` is fine for a lab but unacceptable in production. Restrict to bastion host CIDR, company VPN, or IAM Identity Center session.
4. **VPC Flow Logs enabled** — capture all traffic metadata to S3 or CloudWatch for security investigation and traffic analysis.
5. **AWS Network Firewall** in front of the IGW for managed deep packet inspection if compliance requires it.
6. **VPC Endpoints** (Gateway for S3/DynamoDB, Interface for other services) to keep AWS API traffic off the public internet.

## Cost and cleanup

| Resource | Hourly cost | Lab duration | Estimated cost |
|----------|-------------|--------------|----------------|
| NAT Gateway | $0.045 | ~2.5h | ~$0.11 |
| EIP (attached to NAT GW) | Free while attached | ~2.5h | $0 |
| EC2 t2.micro | Free tier eligible | ~1h | $0 |
| **Total** | | | **~$0.11** |

All resources destroyed via Console teardown in reverse dependency order:
1. EC2 instance terminated
2. NAT Gateway deleted (cost clock stopped here)
3. Elastic IP released (avoids idle-EIP charges)
4. Subnets deleted
5. Route tables deleted (custom only — main RT auto-deleted with VPC)
6. Internet Gateway detached and deleted
7. NACL deleted
8. Security Group deleted
9. VPC deleted
10. Key pair retained for reuse in future labs

Verified clean via CLI:
```bash
aws ec2 describe-vpcs --query "Vpcs[?Tags[?Value=='lab-03-vpc']]" --output table
aws ec2 describe-nat-gateways --query "NatGateways[?State!='deleted']" --output table
aws ec2 describe-addresses --output table
aws ec2 describe-instances --query "Reservations[].Instances[?State.Name!='terminated']" --output table
```

All four returned empty.
