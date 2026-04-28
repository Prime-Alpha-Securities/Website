pipeline {
    agent any

    environment {
        EC2_USER = "ubuntu"
        EC2_HOST = "ec2-18-130-159-18.eu-west-2.compute.amazonaws.com"
        APP_DIR  = "/home/ubuntu/Prime-Alpha-Securities/my-app"
        PEM_KEY  = "${WORKSPACE}/my-app/webkey.pem"
        SSH_KEY_PATH = "${HOME}/.ssh/webkey.pem"
    }

    stages {

        stage('Checkout Code') {
            steps {
                git(
                    branch: 'main',
                    credentialsId: 'github-token',
                    url: 'https://github.com/johanAurel/Prime-Alpha-Securities.git'
                )
            }
        }

        stage('Prepare SSH Key') {
            steps {
                sh '''
                # Set up SSH directory
                mkdir -p ~/.ssh
                chmod 700 ~/.ssh

                # Copy key from workspace to SSH directory
                cp ${PEM_KEY} ${SSH_KEY_PATH}
                chmod 600 ${SSH_KEY_PATH}

                # Also verify the workspace key
                chmod 600 ${PEM_KEY}

                # Add host key to known_hosts
                ssh-keyscan -H ${EC2_HOST} >> ~/.ssh/known_hosts 2>/dev/null || true

                # Test SSH connection
                echo "Testing SSH connectivity..."
                ssh -o StrictHostKeyChecking=no -i ${SSH_KEY_PATH} ${EC2_USER}@${EC2_HOST} "echo 'SSH connection successful'"
                '''
            }
        }

        stage('Package Project') {
            steps {
                sh '''
                cd ${WORKSPACE}/my-app
                echo "Preparing deployment package"
                ls -la webkey.pem
                echo "All files ready for deployment:"
                ls -la | head -15
                '''
            }
        }

        stage('Upload to EC2') {
            steps {
                sh '''
                cd ${WORKSPACE}/my-app
                ssh -o StrictHostKeyChecking=no -i ${SSH_KEY_PATH} ${EC2_USER}@${EC2_HOST} "mkdir -p ${APP_DIR}"

                rsync -avz \
                    -e "ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=no" \
                    . \
                    ${EC2_USER}@${EC2_HOST}:${APP_DIR}/
                '''
            }
        }

        stage('Run Deploy Script') {
            steps {
                sh '''
                ssh -o StrictHostKeyChecking=no -i ${SSH_KEY_PATH} ${EC2_USER}@${EC2_HOST} "
                    cd ${APP_DIR} &&
                    chmod +x deploy.sh &&
                    sudo bash ./deploy.sh
                "
                '''
            }
        }
    }

    post {
        success {
            echo "Deployment completed successfully"
        }

        failure {
            echo "Deployment failed"
        }
    }
}
