# AWS Lab 09 — Auto Scaling Group + Application Load Balancer From Scratch

Built a production-shaped resilient architecture in my own AWS account: 2-tier VPC with public subnets across 2 AZs, Application Load Balancer, Launch Template with IMDSv2 user data, Auto Scaling Group with target tracking policy, then demonstrated self-healing by manually terminating an instance and observing automatic replacement.

## What it demonstrates

- **Multi-AZ resilience pattern** — 2 subnets in different AZs (us-east-1a and us-east-1b) with instances distributed across both
- **Application Load Balancer** distributing HTTP traffic across healthy targets, with health checks at Layer 7
- **Launch Template with IMDSv2 user data** — proper token-based instance metadata queries (lesson carried forward from Lab 04)
- **Auto Scaling Group with target tracking** — desired 2, min 2, max 4, scaling on CPU 60% target
- **ELB health checks** stronger than EC2 status checks — verifies application layer, not just VM status
- **Self-healing via ASG** — terminated instance triggered automatic replacement launch in the same AZ, no manual intervention
- **Production-grade "cattle not pets" pattern** — instances are ephemeral; new instances launched with identical config via launch template

## Architecture
Internet (browser)
                |
                v
          [ Application Load Balancer ]
          (Layer 7, cross-AZ)
                |
          +-----+-----+
          |           |
   us-east-1a      us-east-1b
   Public Subnet   Public Subnet
   10.9.0.0/20     10.9.16.0/20
          |           |
   +------+---+   +---+------+
| EC2 #1  |   | EC2 #2  |
| t3.micro|   | t3.micro|
| Apache  |   | Apache  |
| AL2023  |   | AL2023  |
+---------+   +---------+
|           |
              +-----+-----+
        |
[ Auto Scaling Group ]
min=2, max=4, desired=2
Target Tracking: CPU 60%
Health check: ELB HTTP
## Resources created (and destroyed)

| Resource | Name | Notes |
|----------|------|-------|
| VPC | `lab-09-vpc` | CIDR `10.9.0.0/16`, 2 AZs, 2 public subnets |
| Security Group | `lab-09-web-sg` | HTTP + SSH from 0.0.0.0/0 |
| Launch Template | `lab-09-web-template` | AL2023, t3.micro, IMDSv2 user data installing Apache |
| Application Load Balancer | `lab-09-alb` | Internet-facing, HTTP:80, spanning both AZs |
| Target Group | `lab-09-tg` | HTTP:80, ELB health check on path `/` |
| Auto Scaling Group | `lab-09-asg` | Target tracking on CPU 60%, ELB health checks |
| EC2 instances (2) | Auto-named by ASG | Spread across us-east-1a and us-east-1b |

All resources destroyed at end of lab. CLI-verified clean state.

## Production lesson — "Public subnet ≠ auto-assign public IP"

The **VPC and more** wizard creates public subnets with routing to the Internet Gateway, but by default sets `MapPublicIpOnLaunch: False`. Instances launched into these subnets have private IPs but no public IPs — so they cannot reach the internet during boot, and user data scripts that install packages via `yum install` fail silently.

### The diagnostic sequence

Initial state observed:

```bash
$ aws elbv2 describe-target-health --target-group-arn <tg-arn> --output table
# Target: i-0d9ad087bc33071bc, State: unhealthy, Reason: Target.FailedHealthChecks
```

Then instance details:

```bash
$ aws ec2 describe-instances --filters "Name=tag:aws:autoscaling:groupName,Values=lab-09-asg" \
    --query "Reservations[].Instances[].{ID:InstanceId,State:State.Name,AZ:Placement.AvailabilityZone,PublicIP:PublicIpAddress}" \
    --output table
# PublicIP: None on all instances
```

Then subnet configuration — the root cause:

```bash
$ aws ec2 describe-subnets --filters "Name=vpc-id,Values=<vpc-id>" \
    --query "Subnets[].[SubnetId,AvailabilityZone,MapPublicIpOnLaunch,CidrBlock]" \
    --output table
# MapPublicIpOnLaunch: False on both subnets
```

### The fix

```bash
# Enable auto-assign public IP on both subnets
aws ec2 modify-subnet-attribute --subnet-id <subnet-a-id> --map-public-ip-on-launch
aws ec2 modify-subnet-attribute --subnet-id <subnet-b-id> --map-public-ip-on-launch

# Trigger ASG instance refresh to relaunch instances with the new subnet setting
aws autoscaling start-instance-refresh --auto-scaling-group-name lab-09-asg \
    --preferences '{"MinHealthyPercentage":0,"InstanceWarmup":300}'
```

After the refresh, new instances launched with public IPs, user data completed successfully, Apache started, and target group marked both healthy.

### Why "public subnet" is actually three things

Locking this in as an SRE mental model. A subnet is *fully* public only when ALL three are true:

1. **Route table** has `0.0.0.0/0 → IGW` route ✅ (this is what most people mean by "public")
2. **Subnet auto-assigns public IPs** (`MapPublicIpOnLaunch: True`) — often overlooked
3. **Instance launched with public IP** (either from #2 or explicitly at launch)

If any of the three is missing, "public subnet" doesn't fully work. The VPC wizard defaults to only #1.

## Load balancing observed live

After healthy state, refreshing the ALB DNS URL in browser showed the response cycling between:

- `Instance ID: i-0c8e18ab927491efc, AZ: us-east-1a`
- `Instance ID: i-059712eb4acdeb175, AZ: us-east-1b`

**Live load balancing across two AZs, verified in browser.**

## Self-healing demonstrated

Terminated `i-0c8e18ab927491efc` manually via CLI:

```bash
$ aws ec2 terminate-instances --instance-ids i-0c8e18ab927491efc
```

Monitored the ASG's response:

- **T+0s:** Manual termination
- **T+30-60s:** Instance state: `shutting-down` → `terminated`. ASG detects `desired=2, current=1` mismatch
- **T+90s:** ASG launches replacement `i-00661173fc8803b2d` in `us-east-1a` (same AZ as the terminated one — ASG prefers AZ balance)
- **T+3-4 min:** New instance passes ELB health check, target group marks healthy
- **Browser test:** Refreshing ALB URL now shows the NEW instance ID `i-00661173fc8803b2d`

**No human intervention required.** ASG detected the health mismatch, launched a replacement, ALB registered it, load balancing resumed automatically.

**This is the value proposition of Auto Scaling in one sentence:** *"AWS handles the recovery. You handle the design."*

## Launch Template user data

```bash
#!/bin/bash
yum update -y
yum install -y httpd
systemctl start httpd
systemctl enable httpd

# IMDSv2 token-based metadata queries (lesson from Lab 04)
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)
AZ=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/availability-zone)

cat > /var/www/html/index.html << EOF_HTML
<h1>Lab 09 — Auto Scaling Demo</h1>
<p>Instance ID: $INSTANCE_ID</p>
<p>Availability Zone: $AZ</p>
<p>Served by this specific EC2 instance</p>
EOF_HTML
```

Every instance launched by the ASG runs this script and self-identifies its Instance ID and AZ in the served page. Made load balancing and self-healing visually observable in the browser.

## ASG scaling policy

**Target tracking** with CPU 60% target. The exam pattern this maps to:

> *"Application traffic is unpredictable. How do you scale?"* → Target tracking (AWS handles the math on when to scale up/down)

Alternative policies not used in this lab but tested on the exam:
- **Step scaling** — "If CPU > 70% add 2 instances, if > 90% add 4" (custom step thresholds)
- **Scheduled scaling** — "Every weekday at 8 AM scale to 10 instances" (predictable pattern)

## ELB health check vs EC2 health check

The ASG was configured to use **ELB health checks in addition to EC2 status checks.** Why this matters:

- **EC2 status check** — only verifies the VM is running and reachable (hypervisor sees it, network responds)
- **ELB health check** — verifies application-layer response (HTTP GET on `/` returns 200)

An EC2 instance can be "healthy" (VM running) while its web server is crashed. ELB health check catches this; EC2 status check doesn't. **Always use ELB health checks for load-balanced workloads.**

## Cleanup

Destroyed in reverse dependency order:

1. Deleted ASG with `--force-delete` (auto-terminates instances)
2. Deleted Launch Template
3. Deleted ALB (stops cost clock)
4. Deleted target group (after ALB deletion propagates)
5. Deleted security group (waited for ENIs to fully release)
6. Deleted VPC and all associated networking (via console; deletes subnets, IGW, RT in one operation)

Verified clean via CLI:

```bash
aws ec2 describe-instances --filters "Name=tag:aws:autoscaling:groupName,Values=lab-09-asg" 
aws elbv2 describe-load-balancers --names lab-09-alb
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=lab-09-vpc"
aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names lab-09-asg
```

All returned empty results or "not found" errors — the correct clean state.

## Cost summary

| Resource | Cost rate | Duration | Estimated cost |
|----------|-----------|----------|----------------|
| ALB | $0.02/hr + LCU costs | ~15 hours (overnight run) | ~$0.30-$0.40 |
| 2x t3.micro EC2 | Free tier | ~15 hours | $0 |
| VPC, subnets, IGW, RT | Free | | $0 |
| Auto Scaling Group | Free | | $0 |
| **Total** | | | **~$0.40** |

## What I'd add for production

1. **HTTPS listener on ALB** — with ACM-managed certificate, redirect HTTP → HTTPS. Use ALB's built-in TLS termination.
2. **Route 53 record** — friendly DNS (e.g., `app.example.com`) with health-check-driven routing, alias to ALB
3. **Private subnets with NAT Gateway** — application instances in private subnets, only ALB in public subnets. Instances reach internet via NAT for OS updates.
4. **CloudWatch alarms** — alert on ASG capacity mismatches, ALB target unhealthy states, high CPU trending
5. **Warm pool** — pre-launched instances kept in stopped state; faster scale-up than starting from AMI
6. **Cross-region DR** — ASG in a second region with a lower baseline; Route 53 failover routing between them
7. **AWS WAF in front of ALB** — Layer 7 protection against SQL injection, XSS, common attacks
8. **Restrict SSH** — from 0.0.0.0/0 to bastion host or company VPN CIDR; even better, use SSM Session Manager (no SSH port at all)
9. **Instance role (IAM)** — attach an execution role via instance profile if the application needs to access AWS services (S3, DynamoDB, etc.)
10. **Blue/green deployments** — use ASG instance refresh with launch template versions for zero-downtime deploys

## Exam patterns from this lab

> *"Application must survive an AZ failure with automatic recovery"*
→ **Multi-AZ ASG + ALB + ELB health checks.** ASG replaces failed instances; ALB routes to healthy ones.

> *"Why are ASG instances launching but failing health checks?"*
→ **Check subnet auto-assign public IP setting** (production gotcha from this lab); check security groups; check user data script for errors.

> *"Modernize this ASG that uses Launch Configurations"*
→ **Migrate to Launch Templates** (Launch Configurations are deprecated for new use).

> *"App traffic is unpredictable but need to control cost"*
→ **Target tracking scaling with reasonable min/max bounds.** Set max to control cost ceiling.

