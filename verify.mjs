/**
 * 可爱大肥鱼桌宠 · 发布版自校验
 *   node verify.mjs            （在安装目录里跑，比如 %LOCALAPPDATA%\BlueHairMaid）
 * 逐字节核对几棵树的整树指纹，再逐个核对关键文件的大小与 sha256，最后确认那些
 * **不该出现在包里**的开发期/运行期文件真的没有。退出码 0 = 全部一致。
 *
 * 这是独立仓库（源码即成品，没有「上游蓝本 + 补丁」那回事），所以期望值就是
 * 本仓库构建出来的样子；每趟重新打包后，用下面这条命令重算并写入：
 *     node build\check-release.mjs --emit --write      （在仓库里跑）
 * 它同时会证明 stage\ 与 src\ launcher\ standalone\ defaults\ assets\ 逐字节一致。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// >>>GENERATED 由 build\check-release.mjs --emit --write 生成，别手改这一段
const EXPECT = {
  app: { files: 602, bytes: 74590575, treeSha256: "19d102b73701cf9c7fa5c38f0c14772d4cd843aeec3f020d3384545233224044" },
  launcher: { files: 9, bytes: 338994, treeSha256: "aef481152f3e483392940750a7062ec728f935228197dc4f09ff7354ba8d0943" },
  standalone: { files: 14, bytes: 107723, treeSha256: "8b4260ab8acdb6152263d42a9370d987a023f849ac5de55a80563f459733dd8b" },
  defaults: { files: 4, bytes: 14171, treeSha256: "5fbae451c060b9c19ca3f6171a06c756cca4b0c780244a2e23f58abc6f72bde7" },
};

// 我们自己写的那些关键文件：大小 + sha256（不含 verify.mjs 自己 —— 它一改哈希就变）
const OURS = {
  'app/lib/index.js': [119120, '955b6ec9cca11a36cff059b4a498a9b3a2c827a6ac065dd6e7b4bb0d7a68fb6e'],
  'app/runtime/electron-helper/main.js': [136607, '30b1c6f28015376af40dc4c9d36bdefe2273fef6b96af0c953970a40827b6787'],
  'app/runtime/electron-helper/sprite.js': [202283, 'dd78493ba080b05feb4b7211c9797b97f0fa343f90b8bb3766e97bb6ba718c5e'],
  'app/runtime/electron-helper/targets.js': [9634, '66182dd6ecd76b718f373a1cc7fe30fe46fa14113f3427399912c4ef11e5d461'],
  'app/runtime/electron-helper/shared-core.js': [54314, '7165bc24001c6233d04bd03aa7d35f6569ac933adba7ddeaaef127c1d393c4a7'],
  'app/runtime/electron-helper/events.js': [19049, 'd6d157be8fca131b6f616b64806b2365ecfbe33e94bbc5e3f5a038db19f83e85'],
  'launcher/main.js': [37826, '7a231df8bf4622ba09147ad27c435712d0b86eee8e68de6b2ac6ea29a82a4acc'],
  'launcher/index.html': [101977, '2ce7f2d926d937f222ff2bf12b8af8fced377251cb824b32577c776090706e00'],
  'launcher/preload.js': [3522, 'b48965916de7351de25a18d6bec59edd3bb8d03ded1f89a69fdc81dea2464818'],
  'launcher/paths.js': [3359, '4b33696b9e76cedef10b394dfdc4884bb82754fb262a911fd12ebdcd7f19a9b1'],
  'launcher/pet-api.js': [17045, '8d2ab51f28893e8543e9f49156bee73c9a14314c68867c119ebd1cf91e56df65'],
  'launcher/rec.js': [12015, '56939198ac04c0e8a1e542f2802695f2ed91ba11c65b66d5ccde06b69ca184c8'],
  'launcher/agent.js': [20461, '9c94569a19c84e29ba224ccca01d2b88df0d0f18fd9752bf9faf3782b25ff74f'],
  'launcher/pet.ico': [142521, 'b727ea4dcec32409cb6bc4709489276b5daaf90fe180184298e598b35bcfc6c0'],
  'launcher/package.json': [268, 'c63596ba82b51cf50002ae87a6f37673135070a86b9fd987b22a8fe4ceb7e4cc'],
  'standalone/main.mjs': [27638, 'b5311e06368c786d3a52e00aac8cc4f8ad5d9b0db2bdcaa03e3fc7830dc9fd9c'],
  'standalone/server.mjs': [8923, '38322988bc9d8530726e94454a4942d8f2ef962e98ba68390c05142faae77c1d'],
  'standalone/context.mjs': [12377, 'e2ba0f1978f88875065f8b0f78e4dbe370d50f4853da2c1376a97542d7560c73'],
  'standalone/detect.mjs': [15888, '6567593dc77a8bd835c7b6ff6327bc1cef0d96cb21e6bb37382fdf032b39c219'],
  'standalone/paths.mjs': [4744, '0e19a57a56352992715ae5e92b4e7f9f607b3c349be51d8380666ff41ed1e257'],
  'standalone/online.mjs': [14534, '8b778fc40125a15e0bbac873beca248541041f4f35f77faf18211a559cf52a73'],
  'standalone/ollama.mjs': [8995, '2cfa93db138f04413eeae0be93b5a1cb5f53e0e2a9df103ef6f6ce9392683730'],
  'standalone/check.mjs': [5728, '032c824070891ee5f38e21a4db7555b217ceef7866ae7860c05d642f2a673080'],
  'standalone/stop-pet.mjs': [3407, '401fb5e267494e5a067f74befed021c8047d07bddec48c7778891e9db0ee39e8'],
  'standalone/start-pet.vbs': [1252, '6567c05d4648696b3e0c7c59aabbabaacaf58612816dc1a96197952dfb90844a'],
  'standalone/stop-pet.vbs': [1194, '633b7c027793a4fef0cf1c148ec90708df51ae3b2c1b9fab50a85c8017096a75'],
};
// <<<GENERATED

// 开发期草稿 / 运行期数据：这些一旦出现在安装目录里就是事故（要么把作者私人路径带出去了，
// 要么把上一台机器的密钥、日志、记忆一起打包了）。
const MUST_NOT_EXIST = [
  'patched', // 老发布仓那棵草稿堆（早就不该有了）
  'launcher/cli-result.json', // 控制台跑完一次留下的私人记录（含本机 ollama.exe 绝对路径）
  'standalone/online.json', // 联网模型的 API Key
  'standalone/runtime.json', // 上一只桌宠的 pid/端口
  'standalone/pet-control.json',
  'dsh-pet', // 数据根（人设/记忆/聊天记录）绝不能跟着程序走
  'userdata',
  'launcher/userdata',
];

/** 整树指纹。算法与 build\filters.mjs 的 treeFingerprint 一致：路径 + \0 + 内容 sha + \n */
function fingerprint(dir) {
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) files.push(p);
    }
  })(dir);
  files.sort();
  const h = crypto.createHash('sha256');
  let total = 0;
  for (const f of files) {
    const b = fs.readFileSync(f);
    total += b.length;
    h.update(path.relative(dir, f).split(path.sep).join('/') + '\0' + crypto.createHash('sha256').update(b).digest('hex') + '\n');
  }
  return { files: files.length, bytes: total, treeSha256: h.digest('hex') };
}

let bad = 0;
console.log('可爱大肥鱼桌宠 · 发布版自校验  ' + new Date().toISOString());
console.log('安装目录：' + ROOT);
console.log('（源码：https://github.com/12we21/cute-fat-fish-pet —— MIT，作者 Mikolu）');

for (const [name, exp] of Object.entries(EXPECT)) {
  const dir = path.join(ROOT, name);
  if (!fs.existsSync(dir)) {
    console.log(`\n[${name}] 目录不存在（安装目录里少了 ${name}\\）`);
    bad++;
    continue;
  }
  const got = fingerprint(dir);
  const ok = got.files === exp.files && got.bytes === exp.bytes && got.treeSha256 === exp.treeSha256;
  if (!ok) bad++;
  console.log(`\n[${name}] ${ok ? 'OK' : 'DRIFT'}`);
  console.log(`  files ${got.files} (期望 ${exp.files})   bytes ${got.bytes} (期望 ${exp.bytes})`);
  console.log(`  tree-sha256 ${got.treeSha256}`);
  if (!ok) console.log(`  期望        ${exp.treeSha256}`);
}

console.log('\n[关键文件]');
for (const [rel, [expSize, expHash]] of Object.entries(OURS)) {
  const f = path.join(ROOT, rel.split('/').join(path.sep));
  if (!fs.existsSync(f)) { console.log(`  MISSING ${rel}`); bad++; continue; }
  const st = fs.statSync(f);
  const gotHash = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const okSize = st.size === expSize;
  const okHash = gotHash === expHash;
  if (!okSize || !okHash) bad++;
  console.log(
    `  ${okSize && okHash ? 'OK   ' : 'DRIFT'} ${rel}  ${st.size} (期望 ${expSize})` +
      (okHash ? '  sha256 对' : `  sha256 ${gotHash} 期望 ${expHash}`),
  );
}

console.log('\n[不该出现在包里的东西]');
for (const rel of MUST_NOT_EXIST) {
  const f = path.join(ROOT, rel.split('/').join(path.sep));
  const there = fs.existsSync(f);
  if (there) bad++;
  console.log(`  ${there ? 'DRIFT' : 'OK   '} ${rel}${there ? '  ← 居然在！' : '  不在'}`);
}

console.log(
  '\n结果：' +
    (bad === 0
      ? `全部一致 —— ${Object.keys(EXPECT).length} 棵树的整树指纹 + ${Object.keys(OURS).length} 个关键文件都对得上，开发期/私人文件一个都没混进来`
      : `${bad} 处漂移 —— 这份副本已被改动过`),
);
process.exit(bad === 0 ? 0 : 1);
