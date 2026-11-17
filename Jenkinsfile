pipeline {
    agent any

    tools {
        nodejs 'NodeJS 20'
    }

    triggers {
        // Polls Git every 10 minutes for changes (or triggers immediately on Webhook)
        pollSCM('H/10 * * * *')
    }

    environment {
        CI = 'true'
    }

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }

        stage('Backend Setup') {
            steps {
                dir('backend') {
                    script {
                        if (isUnix()) {
                            sh 'npm ci || npm install'
                        } else {
                            bat 'npm ci || npm install'
                        }
                    }
                }
            }
        }

        stage('Frontend Build') {
            steps {
                dir('frontend') {
                    script {
                        if (isUnix()) {
                            sh 'npm ci || npm install'
                            sh 'npm run api:prod'
                            sh 'npm run build'
                        } else {
                            bat 'npm ci || npm install'
                            bat 'npm run api:prod'
                            bat 'npm run build'
                        }
                    }
                }
            }
        }

        stage('Archive Artifacts') {
            steps {
                archiveArtifacts artifacts: 'frontend/dist/**', fingerprint: true
            }
        }
    }

    post {
        success {
            echo '🎉 Build completed successfully!'
        }
        failure {
            echo '❌ Build failed. Check console output.'
        }
    }
}
