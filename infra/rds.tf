# Managed PostgreSQL. PostGIS ships with RDS PostgreSQL and is enabled once
# per database with `CREATE EXTENSION postgis;` — the backend's migrations do
# this on first run.

resource "aws_db_subnet_group" "main" {
  name_prefix = "${local.name}-"
  subnet_ids  = aws_subnet.private[*].id

  tags = { Name = "${local.name}-db-subnets" }
}

resource "aws_db_instance" "main" {
  identifier_prefix       = "${local.name}-"
  engine                  = "postgres"
  engine_version          = "16.4"
  instance_class          = var.db_instance_class
  allocated_storage       = 20
  max_allocated_storage   = 100
  storage_type            = "gp3"
  storage_encrypted       = true
  db_name                 = "crypt"
  username                = "crypt"
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  multi_az                = false
  skip_final_snapshot     = true
  backup_retention_period = 7
  apply_immediately       = true

  tags = { Name = "${local.name}-postgres" }
}
