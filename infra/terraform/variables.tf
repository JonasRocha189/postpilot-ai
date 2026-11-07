variable "region" {
  description = "AWS region (same as Render and Neon: US East)."
  type        = string
  default     = "us-east-1"
}

variable "app_origins" {
  description = "Origins allowed by the bucket CORS (browser uploads and canvas reads)."
  type        = list(string)
  default = [
    "https://postpilot.jonas-rocha.com",
    "http://localhost:5173",
  ]
}

variable "budget_limit_usd" {
  description = "Monthly cost limit that triggers the alerts."
  type        = string
  default     = "5"
}

variable "budget_email" {
  description = "Who receives the budget alerts."
  type        = string
}
