variable "project_id" {
    description = "The project ID to host the cluster"
    default     = "grand-drive-324003"
}

variable "cluster_name" {
    description = "The name of the cluster"
    default     = "iqa-standard-cluster"
}

variable "filestore_name" {
    description = "The name of the filestore"
    default     = "iqa-filestore"
}

variable "filestore_tier" {
    description = "The type of tier storage"
    default     = "BASIC_HDD"
}

variable "region" {
    description = "The region of the cluster in"
    default     = "us-central1"
}

variable "zone" {
    description = "The zone the cluster in"
    default     = "us-central1-c"
}
