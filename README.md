# Sample MERN with Microservices

This repository contains a React frontend, two Express services, and a MongoDB-backed profile service. It includes Docker builds, a Compose environment for local use, ECR/EKS deployment files, a Helm chart, a Jenkins pipeline, and AWS setup notes.

The local application and repository configuration can be validated here. AWS account resources, Jenkins on EC2, GitHub fork/webhook configuration, and public deployment require your AWS/GitHub accounts and are operator-run steps below; credentials and account-specific identifiers are intentionally not committed.

## Architecture

~~~mermaid
flowchart LR
    User --> LB[Load balancer]
    LB --> FE[React static site<br/>Nginx]
    FE -->|/api/hello| Hello[Hello Express service]
    FE -->|/api/profile| Profile[Profile Express service]
    Profile --> Mongo[(MongoDB)]
    FE -. built and pushed by .-> Jenkins[Jenkins pipeline]
    Jenkins --> ECR[Amazon ECR]
    Jenkins --> EKS[Amazon EKS + Helm]
    EKS --> CW[CloudWatch]
    Jenkins -. optional alerts .-> SNS[Amazon SNS]
~~~

In the local Compose environment, Nginx routes both API prefixes to the correct service. In EKS, the frontend Service is a LoadBalancer and the same Nginx routes use Kubernetes Service DNS.

## Repository map

- frontend — React application and production Nginx container.
- backend/helloService — hello endpoint and liveness endpoint.
- backend/profileService — profile create/list endpoints and MongoDB readiness endpoint.
- docker-compose.yml — local frontend, API services, and MongoDB.
- helm/mern-stack — frontend/API Deployments and Services, MongoDB StatefulSet/PVC, and CPU-based HPAs.
- eks/cluster.yaml — eksctl cluster, worker group, metrics-server, and control-plane log configuration.
- Jenkinsfile — GitHub push build, ECR push, EKS Helm deployment, and optional SNS notification.
- scripts — AWS CLI helpers to create ECR repositories and an SNS topic.

## Run locally

Requirements: Docker Desktop with Docker Compose enabled.

From the repository root:

    docker compose up --build

Open http://localhost:8080. The first run builds all three application images and starts MongoDB with a local-only development password. Set MONGO_ROOT_PASSWORD in your shell before starting Compose if you want a different local password.

In PowerShell, set a different password with:

    $env:MONGO_ROOT_PASSWORD = 'local-development-password'

Check the hello and profile readiness endpoints:

    Invoke-RestMethod http://localhost:8080/api/hello
    Invoke-RestMethod http://localhost:8080/api/profile/health/ready

Add a sample profile and refresh the page:

    Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/profile/addUser -ContentType 'application/json' -Body '{"name":"Ada","age":36}'
    Invoke-RestMethod http://localhost:8080/api/profile/fetchUser

Stop the services with docker compose down. MongoDB data is stored in the named mongo-data volume; remove that volume only when you intend to delete the local database.

The frontend calls same-origin /api routes. Nginx forwards them to hello-service:3001 and profile-service:3002, so browser requests do not depend on localhost URLs or cross-origin settings.

## AWS account preparation

Install and configure AWS CLI, eksctl, kubectl, Helm, and Docker on the machine used for provisioning. Use AWS IAM Identity Center/SSO or an attached IAM role where possible. Do not put AWS keys in this repository.

Confirm the active identity and region before creating resources:

    aws configure sso
    aws sts get-caller-identity
    $env:AWS_REGION = 'us-east-1'

The sample EKS configuration uses us-east-1 by default. Change eks/cluster.yaml or use a matching AWS_REGION consistently before provisioning.

### Fork and GitHub

If you have not forked the upstream repository yet, fork it into your GitHub account. When a checkout's origin still points at upstream, point origin at your fork and retain the original repository as upstream:

    git remote rename origin upstream
    git remote add origin https://github.com/YOUR_USER/SampleMERNwithMicroservices.git
    git push -u origin main

Replace YOUR_USER with your GitHub account name. Configure a GitHub webhook to the Jenkins endpoint after creating the Jenkins job, or use a Jenkins Multibranch Pipeline with the GitHub integration plugin.

This workspace currently has origin set to the Ashu1556 repository. Do not run the remote rename commands above unless that is the upstream repository you intend to sync from.

### Amazon ECR

The helper is safe to rerun and creates these separate repositories: mern-frontend, mern-hello-service, and mern-profile-service.

Run from Git Bash, WSL, or Linux with an AWS identity authorized to manage ECR:

    AWS_REGION=us-east-1 bash scripts/create-ecr-repositories.sh

Jenkins builds commit-tagged images and pushes all three repositories. For manual builds, use the matching repository names and a unique Git commit tag. ECR authentication is obtained through aws ecr get-login-password; never store the login token.

### Amazon EKS and Helm

Review eks/cluster.yaml for region, instance type, desired node count, and node-group maximum. Create the cluster:

    eksctl create cluster -f eks/cluster.yaml
    aws eks update-kubeconfig --region us-east-1 --name mern-eks

The configuration enables EKS control-plane API, audit, authenticator, controller-manager, and scheduler logs in CloudWatch, and installs metrics-server for the HorizontalPodAutoscalers. The example uses public worker networking to keep a learning setup simple; use private nodes and managed egress for production.

Create the MongoDB password Secret in the deployment namespace before the first Helm install. The password should be a 32-byte hexadecimal string so it is safe in the MongoDB connection URI:

    $mongoPassword = -join (1..32 | ForEach-Object { '{0:x2}' -f (Get-Random -Minimum 0 -Maximum 256) })
    kubectl create namespace sample-mern --dry-run=client -o yaml | kubectl apply -f -
    kubectl create secret generic mongodb-auth --namespace sample-mern --from-literal=password=$mongoPassword --dry-run=client -o yaml | kubectl apply -f -

Install manually after the ECR images exist, or let Jenkins deploy them:

    helm upgrade --install sample-mern ./helm/mern-stack --namespace sample-mern --create-namespace --set frontend.image.repository=ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/mern-frontend --set helloService.image.repository=ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/mern-hello-service --set profileService.image.repository=ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/mern-profile-service
    kubectl get pods,svc,hpa -n sample-mern

Replace ACCOUNT with the AWS account ID. EKS worker nodes need ECR pull permissions. The Helm chart creates two replicas of each stateless service, a single MongoDB pod backed by a persistent volume claim, and HPAs for the three stateless Deployments. MongoDB is a single-node learning setup; use a managed Mongo-compatible database or a properly operated replica set for production.

Get the frontend load balancer address after the Service is provisioned:

    kubectl get service sample-mern-frontend -n sample-mern

### Jenkins on EC2

Create an EC2 instance for Jenkins and install Jenkins, Git, Docker, AWS CLI, kubectl, and Helm using the current installation instructions for the chosen Amazon Linux/Ubuntu release. Allow inbound Jenkins access only from trusted administrator IPs, and keep SSH restricted as well. The Jenkins runtime needs Docker build access and AWS permissions.

Prefer an EC2 instance profile over long-lived IAM user keys. Grant it the minimum permissions needed to push to the three ECR repositories, describe/update kubeconfig for the cluster, publish to the optional SNS topic, and deploy the release. Add the Jenkins role to the EKS cluster access entries and associate an appropriate EKS access policy; use namespace-scoped Kubernetes permissions for production.

Create a Pipeline job that loads the Jenkinsfile from your fork. Install the Pipeline, Git, and GitHub integration plugins. Configure the GitHub push webhook/job trigger. Ensure the Jenkins host can reach GitHub, ECR, EKS, and the Docker daemon. Set AWS_REGION and EKS_CLUSTER_NAME to match your resources. The pipeline tags images with the checked-out commit and runs helm upgrade after pushing them.

Before the first build, create the mongodb-auth Secret in the sample-mern namespace as described above. The Jenkins role must have EKS access in addition to AWS API permissions; aws eks update-kubeconfig alone does not grant Kubernetes authorization.

### Monitoring and logs

EKS control-plane logs are enabled by the cluster configuration. Application processes write logs to stdout/stderr so Kubernetes can collect them. To centralize container logs, install the [Amazon CloudWatch Observability EKS add-on](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/install-CloudWatch-Observability-EKS-addon.html) and grant its service account the required CloudWatch agent permissions. AWS documents EKS Pod Identity and IAM roles for service accounts for this permission. Confirm log groups and streams in CloudWatch Logs after the workloads start.

Create CloudWatch alarms for cluster/node CPU and memory, pod restarts, and application errors based on the metrics available in your account. Send alarm actions to an SNS topic. Metrics-server supports Kubernetes autoscaling but does not itself publish CloudWatch metrics.

### Optional SNS / ChatOps alerts

Create an SNS topic for deployment events:

    AWS_REGION=us-east-1 bash scripts/create-sns-topic.sh

To add an email subscriber, set ALERT_EMAIL before running the script and confirm the subscription email. Set the returned ARN as the Jenkins parameter SNS_TOPIC_ARN to receive build success/failure messages. For Slack or Microsoft Teams, connect the topic through [Amazon Q Developer in chat applications](https://docs.aws.amazon.com/chatbot/latest/adminguide/getting-started.html) and subscribe that integration to the topic; the service requires account-side workspace/channel authorization.

## Validation

Run the local checks from the repository root:

    docker compose config
    docker compose up --build
    Invoke-RestMethod http://localhost:8080/api/hello
    Invoke-RestMethod http://localhost:8080/api/profile/health/ready

For the Helm chart, run lint and render checks before deployment:

    helm lint ./helm/mern-stack
    helm template sample-mern ./helm/mern-stack --namespace sample-mern

After deployment, check readiness and autoscaling:

    kubectl rollout status deployment -n sample-mern
    kubectl get pods,svc,hpa -n sample-mern

The included frontend test is run in CI before container builds. AWS deployment checks must run against your configured AWS account and cluster.
