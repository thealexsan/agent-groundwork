FROM debian:stable-slim
COPY --from=mikefarah/yq:4 /usr/bin/yq /usr/bin/yq
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssh-client git curl jq ca-certificates \
	&& rm -rf /var/lib/apt/lists/*
