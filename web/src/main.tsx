import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { PingStatus } from "./PingStatus";

const client = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <h1>Wave — walking skeleton</h1>
    <PingStatus />
  </QueryClientProvider>,
);
