# syntax=docker/dockerfile:1.7

# Sentrix sandbox image: Node 22 + OpenClaw + Python 3 log collector
FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN --mount=type=cache,id=sentrix-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=sentrix-apt-lists,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      bash \
      ca-certificates \
      curl \
      git \
      lsof \
      python3 \
      procps && \
    rm -rf /tmp/*

RUN npm install -g openclaw@latest

RUN mkdir -p /data/agent_logs /opt/sentrix && \
    chown -R node:node /data

COPY collect_logs.py /opt/sentrix/collect_logs.py
COPY entrypoint.sh  /opt/sentrix/entrypoint.sh
COPY openclaw.json  /opt/sentrix/openclaw.json
RUN chmod +x /opt/sentrix/entrypoint.sh /opt/sentrix/collect_logs.py

USER node
WORKDIR /home/node

RUN mkdir -p /home/node/.openclaw && \
    cp /opt/sentrix/openclaw.json /home/node/.openclaw/openclaw.json

ENTRYPOINT ["/opt/sentrix/entrypoint.sh"]
