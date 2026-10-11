// gutto 桌宠 · opencode 插件（形态一 · 共栖）
//
// 纪律（与 scripts/agent-hook.sh 同款）：
// - 只降不升：permission.asked 只做提醒（气泡+系统通知），绝不替主人决策——
//   审批走 opencode 原生流程；
// - fail-open：任何异常吞掉，插件挂了绝不挂 opencode；
// - Stop（session.idle）战报 30 分钟节流。
//
// opencode 1.x loader 约定：default 唯一导出且必须是函数（非函数 export 会让
// 整个插件静默失效）。
import { spawn } from "node:child_process";
import { basename } from "node:path";
import os from "node:os";

// 包根：本插件注册路径是 <包根>/integrations/opencode-plugin（安装器写入）
const PKG_ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const GUTTO = `${PKG_ROOT}/bin/gutto`;
const NOTIFY = `${PKG_ROOT}/scripts/macos-notify.sh`;

const THROTTLE_MS = 30 * 60 * 1000;
let lastIdleReport = 0;

function quietSpawn(argv, timeoutMs = 8000) {
  try {
    const child = spawn(argv[0], argv.slice(1), {
      stdio: "ignore",
      timeout: timeoutMs,
      detached: false,
    });
    child.on("error", () => {});
  } catch {
    // 桌宠不在场/脚本缺失：静默（形态一纪律）
  }
}

function gutto(...args) {
  quietSpawn([GUTTO, ...args]);
}

function systemNotify(title, message) {
  quietSpawn([NOTIFY, title, message], 5000);
}

function projectName(directory) {
  const dir = String(directory || "").replace(/\/+$/, "");
  return basename(dir) || "会话";
}

export default async function guttoPlugin(ctx) {
  const directory = ctx?.directory || process.cwd();

  return {
    async event({ event }) {
      try {
        if (!event || typeof event.type !== "string") return;

        if (event.type === "permission.asked") {
          const props = event.properties || {};
          const tool = props.permission || "操作";
          const name = projectName(directory);
          const text = `${name} 在等你批准「${tool}」`;
          systemNotify("gutto · 审批提醒", text);
          gutto("report", "review", "要你拍板", text);
          return;
        }

        if (event.type === "session.idle") {
          const now = Date.now();
          if (now - lastIdleReport < THROTTLE_MS) return;
          lastIdleReport = now;
          const name = projectName(directory);
          gutto("report", "done", "收工讨赏", `${name} 的会话收工啦，快夸我`);
          return;
        }
        // 其余事件不打扰
      } catch {
        // fail-open：插件异常绝不外泄
      }
    },

    async dispose() {
      // 无常驻资源
    },
  };
}
