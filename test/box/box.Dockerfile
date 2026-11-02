FROM node:lts-bookworm
COPY --from=golang:latest /usr/local/go /usr/local/go
ENV PATH="/usr/local/go/bin:${PATH}"
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssh-server nginx curl git \
	&& rm -rf /var/lib/apt/lists/* /etc/nginx/sites-enabled/default \
	&& npm install -g pm2 \
	&& mkdir -p /run/sshd /root/.ssh \
	&& chmod 700 /root/.ssh \
	&& ssh-keygen -A \
	&& git config --system safe.directory '*' \
	&& ln -s /usr/local/go/bin/go /usr/local/bin/go
CMD ["/usr/sbin/sshd", "-D", "-e"]
