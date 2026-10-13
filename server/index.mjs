import os from "node:os";
import { provider } from "./provider.mjs";
import { createServer } from "./http.mjs";
const host =
  process.env.BRIDGE_HOST ||
  (process.argv.includes("--lan") ? "0.0.0.0" : "127.0.0.1");
const port = Number(process.env.PORT || 8787);
const server = createServer(provider, process.env.BRIDGE_TOKEN || "");
server.listen(port, host, () => {
  console.log(`HongguoTV 内容服务：http://${host}:${port}`);
  if (host === "0.0.0.0") {
    for (const list of Object.values(os.networkInterfaces()))
      for (const nic of list || []) {
        if (nic.family === "IPv4" && !nic.internal)
          console.log(`电视设置 → 服务地址：http://${nic.address}:${port}`);
      }
  }
  console.log(
    "服务用于家庭网络；/health 仅表示进程正常。真实内容状态请运行 npm run probe。"
  );
});
server.on("error", (error) => {
  console.error(error.code);
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close();
    server.closeAllConnections();
  });
