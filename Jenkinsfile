pipeline {
  agent any
  options {
    timestamps()
    disableConcurrentBuilds()
  }
  triggers {
    githubPush()
  }
  parameters {
    string(name: 'AWS_REGION', defaultValue: 'us-east-1', description: 'AWS region containing ECR and EKS')
    string(name: 'EKS_CLUSTER_NAME', defaultValue: 'mern-eks', description: 'Existing EKS cluster to deploy to')
    string(name: 'SNS_TOPIC_ARN', defaultValue: '', description: 'Optional SNS topic ARN for build notifications')
  }
  environment {
    ECR_PREFIX = 'mern'
    K8S_NAMESPACE = 'sample-mern'
    HELM_RELEASE = 'sample-mern'
  }
  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.IMAGE_TAG = sh(script: 'git rev-parse --short=12 HEAD', returnStdout: true).trim()
          env.AWS_ACCOUNT_ID = sh(script: 'aws sts get-caller-identity --query Account --output text', returnStdout: true).trim()
          env.ECR_REGISTRY = "${env.AWS_ACCOUNT_ID}.dkr.ecr.${params.AWS_REGION}.amazonaws.com"
        }
      }
    }
    stage('Test frontend') {
      steps {
        dir('frontend') {
          sh 'npm ci && CI=true npm test -- --watchAll=false && npm run build'
        }
      }
    }
    stage('Build images') {
      steps {
        sh '''
          set -eu
          docker build --pull -t "$ECR_REGISTRY/$ECR_PREFIX-frontend:$IMAGE_TAG" ./frontend
          docker build --pull -t "$ECR_REGISTRY/$ECR_PREFIX-hello-service:$IMAGE_TAG" ./backend/helloService
          docker build --pull -t "$ECR_REGISTRY/$ECR_PREFIX-profile-service:$IMAGE_TAG" ./backend/profileService
        '''
      }
    }
    stage('Push images to ECR') {
      steps {
        sh '''
          set -eu
          aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"
          docker push "$ECR_REGISTRY/$ECR_PREFIX-frontend:$IMAGE_TAG"
          docker push "$ECR_REGISTRY/$ECR_PREFIX-hello-service:$IMAGE_TAG"
          docker push "$ECR_REGISTRY/$ECR_PREFIX-profile-service:$IMAGE_TAG"
        '''
      }
    }
    stage('Deploy to EKS') {
      steps {
        sh '''
          set -eu
          aws eks update-kubeconfig --region "$AWS_REGION" --name "$EKS_CLUSTER_NAME"
          helm upgrade --install "$HELM_RELEASE" ./helm/mern-stack \
            --namespace "$K8S_NAMESPACE" --create-namespace --wait --timeout 10m \
            --set "frontend.image.repository=$ECR_REGISTRY/$ECR_PREFIX-frontend" \
            --set "frontend.image.tag=$IMAGE_TAG" \
            --set "helloService.image.repository=$ECR_REGISTRY/$ECR_PREFIX-hello-service" \
            --set "helloService.image.tag=$IMAGE_TAG" \
            --set "profileService.image.repository=$ECR_REGISTRY/$ECR_PREFIX-profile-service" \
            --set "profileService.image.tag=$IMAGE_TAG"
        '''
      }
    }
  }
  post {
    success {
      script {
        if (params.SNS_TOPIC_ARN?.trim()) {
          sh 'aws sns publish --region "$AWS_REGION" --topic-arn "$SNS_TOPIC_ARN" --subject "MERN deployment succeeded" --message "Build $BUILD_NUMBER deployed commit $IMAGE_TAG successfully."'
        }
      }
    }
    failure {
      script {
        if (params.SNS_TOPIC_ARN?.trim()) {
          sh 'aws sns publish --region "$AWS_REGION" --topic-arn "$SNS_TOPIC_ARN" --subject "MERN deployment failed" --message "Build $BUILD_NUMBER failed for commit $GIT_COMMIT. Review Jenkins console output."'
        }
      }
    }
  }
}
