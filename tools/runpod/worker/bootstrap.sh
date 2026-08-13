#!/usr/bin/env bash
set -Eeuo pipefail

WORKSPACE_PATH=${1:?workspace path required}
ARTIFACT_PATH=${2:?artifact path required}
COMMAND_B64=${3:?base64 command required}
COMMAND_TIMEOUT=${4:?command timeout required}
RUN_ID=${5:?run id required}
SOURCE_B64=${6:?base64 source metadata required}

mkdir -p "$ARTIFACT_PATH"
exec > >(tee -a "$ARTIFACT_PATH/bootstrap.log") 2>&1

echo "[worker] run=$RUN_ID workspace=$WORKSPACE_PATH artifacts=$ARTIFACT_PATH"
echo "[worker] started=$(date -u +%Y-%m-%dT%H:%M:%SZ) command_timeout=${COMMAND_TIMEOUT}s"

export DEBIAN_FRONTEND=noninteractive
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
export RUNPOD_ARTIFACT_DIR=$ARTIFACT_PATH
export RUNPOD_GPU_RUN_ID=$RUN_ID
export RUNPOD_SOURCE_METADATA_B64=$SOURCE_B64

node_major=0
if command -v node >/dev/null 2>&1; then
  node_major=$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)
fi

apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg xz-utils xvfb xauth mesa-utils libvulkan1 vulkan-tools

if [ "$node_major" -lt 20 ]; then
  echo "[worker] installing Node.js 22 from the signed NodeSource repository"
  install -d -m 0755 /etc/apt/keyrings
  curl --fail --silent --show-error --location https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor --yes --output /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y --no-install-recommends nodejs
fi

echo "[worker] node=$(node --version) npm=$(npm --version)"
if ! command -v nvidia-smi >/dev/null 2>&1; then
  echo "[worker] ERROR: nvidia-smi is unavailable; the template or Pod has no usable NVIDIA runtime"
  exit 20
fi
nvidia-smi --query-gpu=name,uuid,driver_version,memory.total --format=csv,noheader | tee "$ARTIFACT_PATH/nvidia-smi.csv"
vulkaninfo --summary > "$ARTIFACT_PATH/vulkaninfo.txt" 2>&1 || true

cd "$WORKSPACE_PATH/tools"
npm ci --no-audit --no-fund
npx playwright install-deps chromium
mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"
npx playwright install chromium

display_number=99
export DISPLAY=":$display_number"
Xvfb "$DISPLAY" -screen 0 1920x1080x24 -nolisten tcp +extension GLX +render -noreset \
  > "$ARTIFACT_PATH/xvfb.log" 2>&1 &
xvfb_pid=$!
cleanup_display() {
  kill "$xvfb_pid" >/dev/null 2>&1 || true
  wait "$xvfb_pid" >/dev/null 2>&1 || true
}
trap cleanup_display EXIT
sleep 1

export RUNPOD_SOURCE_REVISION
RUNPOD_SOURCE_REVISION=$(printf '%s' "$SOURCE_B64" | base64 --decode | node -e '
  let input=""; process.stdin.on("data", c => input += c); process.stdin.on("end", () => {
    try { process.stdout.write(JSON.parse(input).revision || "unknown"); } catch { process.stdout.write("unknown"); }
  });
')

TEST_COMMAND=$(printf '%s' "$COMMAND_B64" | base64 --decode)
echo "[worker] command=$TEST_COMMAND"
cd "$WORKSPACE_PATH"
set +e
timeout --signal=TERM --kill-after=30s "${COMMAND_TIMEOUT}s" bash -lc "$TEST_COMMAND" \
  > >(tee "$ARTIFACT_PATH/command.stdout.log") \
  2> >(tee "$ARTIFACT_PATH/command.stderr.log" >&2)
command_status=$?
set -e

export RUNPOD_COMMAND_STATUS=$command_status
export RUNPOD_COMMAND_TEXT=$TEST_COMMAND
node --input-type=module -e '
  import fs from "node:fs";
  import os from "node:os";
  import path from "node:path";
  const artifacts = process.env.RUNPOD_ARTIFACT_DIR;
  let source = null;
  try { source = JSON.parse(Buffer.from(process.env.RUNPOD_SOURCE_METADATA_B64, "base64").toString()); } catch {}
  const result = {
    schema: "elder-souls/runpod-worker-result@1",
    runId: process.env.RUNPOD_GPU_RUN_ID,
    finishedAt: new Date().toISOString(),
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    node: process.version,
    display: process.env.DISPLAY,
    source,
    command: process.env.RUNPOD_COMMAND_TEXT,
    exitCode: Number(process.env.RUNPOD_COMMAND_STATUS),
    passed: Number(process.env.RUNPOD_COMMAND_STATUS) === 0,
  };
  fs.writeFileSync(path.join(artifacts, "worker-result.json"), `${JSON.stringify(result, null, 2)}\n`);
'

echo "[worker] finished=$(date -u +%Y-%m-%dT%H:%M:%SZ) exit=$command_status"
exit "$command_status"
