// Checks this process and its configured authentication, not upstream content.
try {
  const response = await fetch(
    `http://127.0.0.1:${process.env.PORT || 8787}/health`,
    {
      headers: process.env.BRIDGE_TOKEN
        ? { Authorization: `Bearer ${process.env.BRIDGE_TOKEN}` }
        : {},
      signal: AbortSignal.timeout(4000),
    }
  );
  const data = await response.json();
  if (!response.ok || data.service !== "hongguotv" || data.apiVersion !== 1)
    process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
