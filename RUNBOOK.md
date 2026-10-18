# RUNBOOK · 本地迭代测试流程

本文件只给本地开发用：它**不参与打包**（不会被复制进 `stage\` 或发布包）。
文中 `<仓库根>`、`<安装目录>`、`<测试数据目录>` 都是占位符，按你自己的实际路径替换。

## 0. 前提：一块外部运行时（Electron）

`npm run build` 需要一块**不进 git** 的 Electron 运行时（43.3.0 win-x64，约 347 MB）。
找法优先级（见 `build/toolchain.mjs`，第一个能用的就用）：

1. 命令行 `--toolchain <目录>` / `--electron <目录>`
2. 环境变量 `BLUEHAIRMAID_TOOLCHAIN` / `BLUEHAIRMAID_ELECTRON`
3. 常见位置 `%LOCALAPPDATA%\BlueHairMaid`、`%ProgramFiles%\BlueHairMaid`、`%USERPROFILE%\BlueHairMaid`

只要 `<目录>` 下面有个名叫 `electron` 的子目录、里面有 `electron.exe` 就行。

**一次性固定来源**（最省事，用户级持久）：

```powershell
# 把 <安装目录> 换成你装过「可爱大肥鱼桌宠」的位置（默认 %LOCALAPPDATA%\BlueHairMaid）
[Environment]::SetEnvironmentVariable('BLUEHAIRMAID_TOOLCHAIN','<安装目录>','User')
```

之后 `npm run build` 不用再带参数。已开着的终端要**重开**才读得到；临时用就
`$env:BLUEHAIRMAID_TOOLCHAIN='<安装目录>'`。也可以单次指定：`npm run build -- --toolchain "<安装目录>"`。

查看当前能不能找到：`npm run toolchain`

## 1. 每次改完代码 → 重铺 → 校验

```powershell
cd <仓库根>
npm run build      # 按 mtime 只复制有改动的文件；没变就跳过（含 Electron）
npm run check      # = build/check-release.mjs：校验 stage 与仓库源码逐字节一致、无垃圾混入
```

- `npm run build` 里已含**隐私路径门禁**（`build/check-paths.mjs`）；门禁不过会直接停下，先修掉再打。
- 只想看会复制什么、不落盘：`npm run list`。

## 2. 启动看效果（隔离）

改完代码看界面用这一套，**不碰**你已装版本的记忆/设置。

```powershell
# 建议把测试数据目录放在仓库外
$env:DSH_PET_DATA_DIR = "<测试数据目录>"
& "<仓库根>\stage\electron\electron.exe" "<仓库根>\stage\launcher"
```

- 环境变量必须在**启动前**、在**同一个终端**里设。
- 不带 `DSH_PET_DATA_DIR` 时用 `%APPDATA%\BlueHairMaid`（与已装版共用，等同"就地升级"）。
- 想永久隔离又不想每次设：把路径写进 `<仓库根>\stage\data-root.txt`（一行，一个路径）。
- 数据根规则（`launcher/paths.js` 与 `standalone/paths.mjs` 一致）：
  `DSH_PET_DATA_DIR` > `stage\data-root.txt` > `stage\portable.txt`（→ `stage\userdata`）> `%APPDATA%\BlueHairMaid`

## 3. 停止

```powershell
Push-Location "<仓库根>\stage\launcher"; & "..\electron\electron.exe" . --stop; Pop-Location
# 再关掉控制台窗口
```

桌宠是**分离进程**：关宿主 PowerShell 窗口、关控制台窗口都**不会**关掉它。
要么用桌宠/控制台自己的"退出"，要么先 `--stop` 停桌宠、再关控制台窗口。

## 4. `npm run verify` 什么时候才需要

`npm run verify` 跑的是 **`stage\verify.mjs` 这份副本**，拿**固定指纹**比对。

- 改过代码后指纹就过期了，此时 verify 报 DRIFT 是**预期**的，不代表出错 —— 日常一致性看 `npm run check` 就够。
- 只有当你要产出一份"能自证未被改动"的包时，才刷新指纹。
  顺序有讲究：`--write` 写的是**仓库根**的 `verify.mjs`，而 `verify` 读的是 **stage 里的副本**，所以中间必须再 build 一次：

```powershell
npm run build
node build\check-release.mjs --emit --write
npm run build
npm run verify
```

## 5. 两个坑

1. **删了源码文件**：`copyTree` 只增不删，`stage\` 里会留下旧副本 →
   `npm run clean` 清空 stage 后再 `npm run build`（重铺会重新拷 Electron，稍慢）。
2. **进程**：见第 3 节，关窗口关不掉应用。

## 6. 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run build` | 铺 `stage\`（含隐私路径门禁） |
| `npm run check` | 校验 stage 与仓库源码逐字节一致、无垃圾 |
| `npm run verify` | 在 `stage\` 里跑自校验（需指纹是最新的） |
| `npm run toolchain` | 看外部运行时能不能找到 |
| `npm run list` | 只看这次会复制什么，不落盘 |
| `npm run clean` | 清空 `stage\` |
| `npm run paths` | 单独跑隐私路径门禁 |
