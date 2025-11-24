output "instance_id" {
  value = aws_instance.web[*].id
  description = "all ids of current instances"
}
