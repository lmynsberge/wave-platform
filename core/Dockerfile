FROM rust:1.94-slim AS build
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=build /app/target/release/wave-core /usr/local/bin/wave-core
COPY migrations ./migrations
EXPOSE 8081
CMD ["wave-core"]
