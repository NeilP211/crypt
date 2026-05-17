output "alb_dns_name" {
  description = "Public DNS name of the load balancer"
  value       = aws_lb.main.dns_name
}

output "rds_endpoint" {
  description = "Address of the PostgreSQL/PostGIS instance"
  value       = aws_db_instance.main.address
}

output "images_bucket" {
  description = "Name of the imagery S3 bucket"
  value       = aws_s3_bucket.images.id
}

output "cloudfront_domain" {
  description = "CloudFront domain serving location imagery"
  value       = aws_cloudfront_distribution.images.domain_name
}

output "ecs_cluster" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}
