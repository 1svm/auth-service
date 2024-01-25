Command used for generating self-signed SSL certificates

```
mkcert -install -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 0.0.0.0 ::1
```

Command for building Dockerfile.dev

```
docker build --no-cache -f Dockerfile.dev -t auth-service:0.0.1 .
```

Command for running docker container

```
docker run --rm -it -v $(pwd)/src:/opt/app/src -p 443:443 auth-service:0.0.1
```
