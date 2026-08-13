#!/usr/bin/env bash
set -Eeuo pipefail

export DEBIAN_FRONTEND=noninteractive
if ! command -v sshd >/dev/null 2>&1; then
  timeout 90s apt-get update
  timeout 90s apt-get install -y --no-install-recommends openssh-server ca-certificates
fi

ssh_public_key=${SSH_PUBLIC_KEY:-${PUBLIC_KEY:-}}
if [ -z "$ssh_public_key" ]; then
  echo "SSH_PUBLIC_KEY is required" >&2
  exit 2
fi

mkdir -p /run/sshd /root/.ssh
chmod 700 /root/.ssh
printf '%s\n' "$ssh_public_key" > /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
ssh-keygen -A

exec /usr/sbin/sshd -D -e
