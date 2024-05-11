pipeline {
    agent any

    options{
        // Max number of build logs to keep and days to keep
        buildDiscarder(logRotator(numToKeepStr: '5', daysToKeepStr: '5'))
        // Enable timestamp at each job in the pipeline
        timestamps()
    }

    environment{
        registry = 'longpk1/iqa_v2_1'
        registryCredential = 'dockerhub'
    }

    stages {
        stage("Build") {
            steps {
                script {
                    echo "Building image for deployment ..."
                    dockerImage = docker.build registry + ":1.5.7"
                    echo "Pushing image to dockerhub ..."
                    docker.withRegistry( '', registryCredential ) {
                        dockerImage.push()
                    }
                    echo "Pushing image successfully, ready to deploy on k8s ..."
                }
            }
        }
        stage("Deploy") {
            agent {
                kubernetes {
                    containerTemplate {
                        name 'helm' // Name of the container to be used for helm upgrade
                        image 'longpk1/jenkins:lts' // The image containing helm
                        alwaysPullImage true // Always pull image in case of using the same tag
                    }
                }
            }
            steps {
                script {
                    container("helm") {
                        echo "Ready to deploy ..."
                        sh "helm upgrade --install iqa-ingress ./helm/ingress"
                        sh "helm upgrade --install iqa-datalake ./helm/datalake"
                        sh "helm upgrade --install iqa-app ./helm/app"
                        echo "Deploy successfully, ready to serve request ..."
                    }
                }
            }
        }
    }
}
