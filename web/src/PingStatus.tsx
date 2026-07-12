import { useQuery } from "@tanstack/react-query";

export interface PingResponse {
  server: string;
  core: { service: string; status: string } | null;
  error?: string;
}

export async function fetchPing(): Promise<PingResponse> {
  const res = await fetch("/api/ping");
  return (await res.json()) as PingResponse;
}

export function PingStatus() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["ping"],
    queryFn: fetchPing,
    retry: false,
  });

  if (isPending) return <p>Checking services…</p>;
  if (isError || !data) return <p role="alert">server: unreachable</p>;

  if (data.core === null) {
    return (
      <div>
        <p>server: {data.server}</p>
        <p role="alert">core: unreachable (degraded)</p>
      </div>
    );
  }

  return (
    <div>
      <p>server: {data.server}</p>
      <p>
        core: {data.core.status} ({data.core.service})
      </p>
    </div>
  );
}
