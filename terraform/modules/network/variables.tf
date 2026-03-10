variable "vpc_name" {
  description = "Name of the VPC"
  type        = string
}

variable "cidr_range" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/20"
}

variable "availability_zones" {
  description = "List of availability zones to deploy subnets into"
  type        = list(string)
}

variable "public_subnets" {
  description = "List of CIDR blocks for public subnets (one per AZ)"
  type        = list(string)

  validation {
    condition     = length(var.public_subnets) >= 2
    error_message = "At least 2 public subnets are required for the ALB."
  }
}

variable "private_subnets" {
  description = "List of CIDR blocks for private subnets (one per AZ)"
  type        = list(string)
}

variable "target" {

type = string

}

variable "acm_certificate_arn" {
  description = "ACM certificate for HTTPS"
  type        = string
}