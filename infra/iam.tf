# IAM roles for the ECS tasks: a task-execution role (pull images, ship logs)
# and a task role with a tightly scoped policy for the imagery bucket.

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name_prefix        = "${local.name}-exec-"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name_prefix        = "${local.name}-task-"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

# The task role may only read and write objects in the imagery bucket — no
# wildcard S3 access.
data "aws_iam_policy_document" "task_s3" {
  statement {
    sid       = "ImageObjects"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.images.arn}/*"]
  }

  statement {
    sid       = "ImageBucketList"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.images.arn]
  }
}

resource "aws_iam_role_policy" "task_s3" {
  name_prefix = "${local.name}-s3-"
  role        = aws_iam_role.ecs_task.id
  policy      = data.aws_iam_policy_document.task_s3.json
}
