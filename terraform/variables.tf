variable "availability_zones" {
  type = list(string)
}

variable "code" {
 
  type = string
   
}

variable "user" {

 type = string

}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate used for HTTPS"
  type        = string
}