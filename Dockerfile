FROM node:25-alpine AS frontend

RUN npm install -g pnpm
WORKDIR /app
COPY ui/package.json ui/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY ui/ .
RUN pnpm build

FROM golang:1.26-alpine AS backend

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=frontend /app/out ui/out
ENV CGO_ENABLED=0
RUN go build -o podcast-server .

FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata
RUN adduser -D app
USER app
WORKDIR /app
COPY --from=backend /app/podcast-server .

EXPOSE 3000
ENTRYPOINT ["/app/podcast-server", "--addr", ":3000"]
