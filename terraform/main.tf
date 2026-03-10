
# Define the networking module
module "networking" {
  source             = "./modules/network/"
  vpc_name           = "nc-ce-load-balancing-vpc"
  cidr_range         = "10.0.0.0/20"
  availability_zones = var.availability_zones   # ← defined in root variables.tf
  public_subnets     = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets    = ["10.0.8.0/24", "10.0.9.0/24", "10.0.10.0/24"]
  target = module.ec2.instance_id[0]
  acm_certificate_arn = var.acm_certificate_arn
}

# Define the EC2 module
module "ec2" {
  source   = "./modules/app"
  subnet    = module.networking.public_subnets[0] 
  security = [module.networking.alb_security_group_id]  # Pass security group ID as a list
}

resource "aws_route53_record" "app" {
  zone_id = "Z069844120BD3FPDOUVD2"
  name    = "app.primealphasecurities.com"
  type    = "A"

  alias {
    name                   = module.networking.alb_dns_name   # adjust to your output
    zone_id                = module.networking.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_lb_target_group_attachment" "app" {
  target_group_arn = module.networking.alb_target_group_arn
  target_id        = module.ec2.instance_id[0]   # ← add [0]
  port             = 80
}

resource "aws_route53_record" "root" {
  zone_id = "Z069844120BD3FPDOUVD2"
  name    = "primealphasecurities.com"
  type    = "A"

  alias {
    name                   = module.networking.alb_dns_name
    zone_id                = module.networking.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_dynamodb_table" "app_tables" {
  count = 10

  name = [
    "investor",
    "portfolios",
    "documents",
    "workers",
    "calendar",
    "pe_companies",
    "credit_application",
    "real_estate",
    "articles",
    "enquiries"
  ][count.index]

  billing_mode = "PAY_PER_REQUEST"

  hash_key = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Environment = "dev"
  }
}
