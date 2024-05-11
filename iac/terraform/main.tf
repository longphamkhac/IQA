# Ref: https://github.com/terraform-google-modules/terraform-google-kubernetes-engine/blob/master/examples/simple_autopilot_public
# To define that we will use GCP
terraform {
    required_providers {
        google = {
        source = "hashicorp/google"
        version = "4.80.0" // Provider version
        }
    }
    required_version = "1.8.0" // Terraform version
}

// The library with methods for creating and
// managing the infrastructure in GCP, this will
// apply to all the resources in the project
provider "google" {
    project = var.project_id
    region  = var.region
}

// Google Kubernetes Engine
resource "google_container_cluster" "terraform_gke" {
    name     = var.cluster_name
    location = var.zone

    remove_default_node_pool = true
    initial_node_count       = 1
}

resource "google_container_node_pool" "primary_preemptible_nodes" {
    name       = "default-pool"
    location   = var.zone
    cluster    = google_container_cluster.terraform_gke.name
    node_count = 1

    node_config {
      preemptible  = true
      machine_type = "n2-standard-8" # 2 CPU and 8 GB RAM
    }
}

// Google Filestore
resource "google_filestore_instance" "instance" {
  name     = "iqa-filestore"
  location = "us-central1-c"
  tier     = "BASIC_HDD"

  file_shares {
    capacity_gb = 1024
    name        = "shared"

    nfs_export_options {
      ip_ranges   = ["0.0.0.0/0"]
      access_mode = "READ_WRITE"
      squash_mode = "NO_ROOT_SQUASH"
    }
  }

  networks {
    network = "default"
    modes   = ["MODE_IPV4"]
  }
}
