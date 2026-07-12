FROM rust:1.79-slim AS build
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=build /app/target/release/wave-core /usr/local/bin/wave-core
EXPOSE 8081
CMD ["wave-core"]
