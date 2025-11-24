variable "security_groups" {
  type = list(string)
}
variable "subnets" {
  type = list(string)
}
variable "vpc_id" {
  type = string
}
variable "target_id" {
  type = string
}