FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/root/.cargo/bin:${PATH}"

RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    wget \
    file \
    pkg-config \
    build-essential \
    clang \
    mold \
    libwebkit2gtk-4.1-dev \
    libxdo-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
 && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
 && rustup default stable \
 && rustup target add aarch64-unknown-linux-gnu

WORKDIR /app