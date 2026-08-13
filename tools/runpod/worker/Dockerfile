# Optional purpose-built image for faster repeat runs. The CLI also bootstraps the supplied
# Ubuntu 24.04 NVIDIA template, so publishing this image is not required for correctness.
FROM runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404

ENV DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers

RUN install -d -m 0755 /etc/apt/keyrings \
    && curl --fail --silent --show-error --location https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
       | gpg --dearmor --yes --output /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
       > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs xvfb xauth mesa-utils \
    && npm install --global playwright@1.56.1 \
    && playwright install --with-deps chromium \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# The CLI creates a private per-run template that launches worker/ssh-entrypoint.sh with an
# ephemeral public key. This image therefore does not bake credentials into a layer or depend on
# the inherited image CMD to start SSH.
