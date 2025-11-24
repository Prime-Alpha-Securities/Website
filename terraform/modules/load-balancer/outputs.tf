output "DNS_name" {
 value = aws_lb.test-lb.dns_name
description = "name of dns you can access"
}