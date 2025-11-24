# Define the networking module
module "networking" {
  source              = "./modules/network/"
  vpc_name            = "nc_ce_load_balancing_vpc"
  cidr_range          = "10.0.0.0/20"
  availability_zones  = var.availability_zones
  public_subnets      = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets     = ["10.0.8.0/24", "10.0.9.0/24", "10.0.10.0/24"]
}

# Define the security module
module "security" {
  source = "./modules/security/"
  vpc_id = module.networking.vpc_id
}

# Define the EC2 module
module "ec2" {
  source   = "./modules/app"
  array    = module.networking.private_subnets  # Should use private subnets for EC2 instances
  security = [module.security.security_group_id]  # Pass security group ID as a list
}

# Define the load balancer module
module "lb" {
  source          = "./modules/load-balancer/"
  security_groups = [module.security.security_group_id]  # Pass security group ID as a list
  subnets         = module.networking.public_subnets
  vpc_id          = module.networking.vpc_id
  target_id       = module.ec2.instance_id[0]  # Ensure this is the correct reference
}

# Output the instance IDs from the EC2 module
output "instance_ids" {
  value = module.ec2.instance_id  # Ensure the EC2 module outputs instance IDs as a list
}
