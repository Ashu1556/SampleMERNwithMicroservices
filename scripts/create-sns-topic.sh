#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
TOPIC_NAME="${SNS_TOPIC_NAME:-mern-deployment-events}"
TOPIC_ARN="$(aws sns create-topic --region "$AWS_REGION" --name "$TOPIC_NAME" --query TopicArn --output text)"
echo "SNS topic: $TOPIC_ARN"

if [[ -n "${ALERT_EMAIL:-}" ]]; then
  aws sns subscribe \
    --region "$AWS_REGION" \
    --topic-arn "$TOPIC_ARN" \
    --protocol email \
    --notification-endpoint "$ALERT_EMAIL"
  echo "Confirm the subscription using the email sent to $ALERT_EMAIL."
fi

echo "Set SNS_TOPIC_ARN to this value in the Jenkins pipeline to enable deployment alerts."
