#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

for name in mern-frontend mern-hello-service mern-profile-service; do
  if aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$name" >/dev/null 2>&1; then
    echo "ECR repository already exists: $name"
  else
    aws ecr create-repository \
      --region "$AWS_REGION" \
      --repository-name "$name" \
      --image-scanning-configuration scanOnPush=true \
      --encryption-configuration encryptionType=AES256 \
      --tags Key=Project,Value=sample-mern-microservices
  fi
done

printf 'ECR registry: %s.dkr.ecr.%s.amazonaws.com\n' "$AWS_ACCOUNT_ID" "$AWS_REGION"
