/**
 * 发布版路径规则（唯一权威：ESM 版）
 * ---------------------------------------------------------------------------
 * 安装目录 = 只读的程序目录（默认 %LOCALAPPDATA%\BlueHairMaid，装的时候可以自己选）
 * 用户数据 = 按优先级：
 *   1) 环境变量 DSH_PET_DATA_DIR             （测试/高级用法）
 *   2) 程序目录里的 data-root.txt            （内容 = 一个路径；绝对路径，或相对程序目录）
 *   3) 程序目录里的 portable.txt → <安装目录>\userdata\   （便携）
 *   4) 默认 %APPDATA%\BlueHairMaid\          ← 每个人的账号各一份，装到只读目录也能跑
 *
 * 桌宠插件本身只认环境变量 DSH_HOME：它会在 DSH_HOME 下面找 dsh-pet\ 当数据根。
 * 所以这里把 DSH_HOME 指到「用户数据目录」，数据根就落在
 *   <用户数据>\dsh-pet\      （人设、记忆、屏幕监测、录屏配置…）
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const APP_NAME = "BlueHairMaid"; // 目录名用 ASCII，显示名才用中文
export const DISPLAY_NAME = "蓝毛小女仆";

/** %APPDATA%（Roaming） */
export function appDataDir() {
  return process.env.APPDATA || join(process.env.USERPROFILE || ".", "AppData", "Roaming");
}

/** 用户数据根在哪（见文件头注释的四条优先级） */
export function dataRootInfo(root, env = process.env) {
  const envDir = String(env.DSH_PET_DATA_DIR || "").trim();
  if (envDir) return { userRoot: resolve(root, envDir), source: "env", file: null };
  const file = join(root, "data-root.txt");
  if (existsSync(file)) {
    const line = readFileSync(file, "utf8")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => s && !s.startsWith("#"));
    if (line) return { userRoot: resolve(root, line), source: "file", file };
  }
  if (existsSync(join(root, "portable.txt"))) return { userRoot: join(root, "userdata"), source: "portable", file: join(root, "portable.txt") };
  return { userRoot: join(appDataDir(), APP_NAME), source: "appdata", file: null };
}

/**
 * @param {string} standaloneDir  standalone\ 目录的绝对路径
 */
export function resolvePaths(standaloneDir) {
  const root = dirname(standaloneDir); // 安装根
  const data = dataRootInfo(root);
  const userRoot = data.userRoot;
  return {
    root,
    portable: data.source !== "appdata",
    dataRootSource: data.source,
    dataRootFile: data.file,
    userRoot,
    dataRoot: join(userRoot, "dsh-pet"),
    consoleUserData: join(userRoot, "console"),
    deviceProfile: join(userRoot, "device-profile.json"),
    defaultsDir: join(root, "defaults", "dsh-pet"),
    electronExe: join(root, "electron", "electron.exe"),
    appDir: join(root, "app"),
    runnerMain: join(standaloneDir, "main.mjs"),
  };
}

/** 首次运行：把 defaults\dsh-pet\ 里缺的文件补进数据根（**绝不覆盖已有**） */
export function seedUserData(paths) {
  let made = 0;
  if (!existsSync(paths.defaultsDir)) return made;
  const walk = (from, to) => {
    for (const e of readdirSync(from, { withFileTypes: true })) {
      const src = join(from, e.name);
      const dst = join(to, e.name);
      if (e.isDirectory()) {
        mkdirSync(dst, { recursive: true });
        walk(src, dst);
      } else if (!existsSync(dst)) {
        mkdirSync(dirname(dst), { recursive: true });
        copyFileSync(src, dst);
        made++;
      }
    }
  };
  mkdirSync(paths.dataRoot, { recursive: true });
  walk(paths.defaultsDir, paths.dataRoot);
  return made;
}

/**
 * 把路径规则写进环境变量（必须在 import 桌宠插件之前调用）。
 *
 * DSH_HOME 必须**强制**指到本应用的用户数据目录，不能沿用外部已有的值：
 * 装了 DeepSeek Harness 之类软件的用户，环境里可能本来就有 DSH_HOME=%USERPROFILE%\.dsh，
 * 那样桌宠就会把数据写进 .dsh\dsh-pet，和别的桌宠实例混在一起（实测过，会被带跑偏）。
 * 想换数据目录请用 DSH_PET_DATA_DIR / data-root.txt / portable.txt 这三样。
 */
export function applyEnv(paths, env = process.env) {
  env.DSH_HOME = paths.userRoot;
  if (!env.DSH_PET_ELECTRON_PATH && existsSync(paths.electronExe)) env.DSH_PET_ELECTRON_PATH = paths.electronExe;
  return env;
}

/**
/** 读「自动适配」结果（没有就返回 null） */
export function readDeviceProfile(paths) {
  try {
    return JSON.parse(readFileSync(paths.deviceProfile, "utf8"));
  } catch {
    return null;
  }
}
