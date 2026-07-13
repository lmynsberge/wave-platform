ENV ?= demo
init:
	cd envs/$(ENV) && terraform init -backend-config="bucket=$(PROJECT)-wave-tf-state"
plan:
	cd envs/$(ENV) && terraform plan
apply:
	cd envs/$(ENV) && terraform apply
fmt:
	terraform fmt -recursive
check:
	terraform fmt -check -recursive && cd envs/$(ENV) && terraform validate
