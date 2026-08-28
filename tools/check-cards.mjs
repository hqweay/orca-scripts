#!/usr/bin/env node
/**
 * 卡片检查器（发版前自检，无依赖）：node tools/check-cards.mjs
 *
 * 语义对齐沙箱运行时：语法检查用 AsyncFunction（沙箱脚本支持顶层 await）。
 *
 * error（退出码 1）：
 *  - cards.json 非法 / 条目缺字段 / file 不存在
 *  - 缺少 <!-- @inject-template-id --> 标记或与 id 不一致
 *  - <script> 语法不可解析
 *  - 使用了 $embed.config 却从未声明 $embed.defineConfig（配置表单不会存在）
 * warn（仅提示）：
 *  - 手写 lets.embed-view.config 原始属性读取（应迁移到 $embed.config）
 *  - defineConfig 声明的配置项名称在脚本中从未出现（死配置）
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = false;
const warn = (card, msg) => console.log(`  ⚠ [${card}] ${msg}`);
const error = (card, msg) => {
  console.log(`  ✗ [${card}] ${msg}`);
  failed = true;
};

let entries;
try {
  entries = JSON.parse(readFileSync(join(root, "cards.json"), "utf8"));
  if (!Array.isArray(entries)) throw new Error("not an array");
} catch (e) {
  console.log("✗ cards.json 非法：", e.message);
  process.exit(1);
}

for (const entry of entries) {
  const card = entry.id || "(no id)";
  if (!entry.id || !entry.file || !Number.isInteger(entry.version) || entry.version < 1) {
    error(card, "cards.json 条目缺 id / file / version");
    continue;
  }
  const path = join(root, "cards", entry.file);
  if (!existsSync(path)) {
    error(card, `cards/${entry.file} 不存在`);
    continue;
  }
  const html = readFileSync(path, "utf8");

  // 标记一致性
  const marker = html.match(/<!--\s*@inject-template-id:\s*([\w-]+)\s*-->/);
  if (!marker) error(card, "缺少 @inject-template-id 标记");
  else if (marker[1] !== entry.id) error(card, `标记 id "${marker[1]}" 与 cards.json id "${entry.id}" 不一致`);

  // 语法可解析（AsyncFunction 对齐沙箱：支持顶层 await）
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (scripts.length === 0) error(card, "没有 <script> 段");
  for (const code of scripts) {
    try {
      new AsyncFunction(code);
    } catch (e) {
      error(card, `script 语法错误：${e.message}`);
    }
  }

  // 配置契约：用 $embed.config 必须声明 defineConfig
  const usesConfig = /\$embed\s*\.\s*config\b/.test(html);
  const declares = /\$embed\s*\.\s*defineConfig\s*\(/.test(html);
  if (usesConfig && !declares) {
    error(card, "使用了 $embed.config 但未调用 $embed.defineConfig —— 配置表单不会存在");
  }

  // 手写原始配置属性（平台 API 之前的旧协议）
  if (/lets\.embed-view\.config/.test(html)) {
    warn(card, "手写读取 lets.embed-view.config——建议迁移到 $embed.config（宿主注入）");
  }

  // 死配置：声明的配置项名称在脚本中从未出现（宽松字面检测，advisory）
  if (declares) {
    const declStart = html.indexOf("$embed.defineConfig(");
    const declEnd = html.indexOf("]);", declStart);
    const declBlock = html.slice(declStart, declEnd);
    const names = [...declBlock.matchAll(/name\s*:\s*["']([\w-]+)["']/g)].map((m) => m[1]);
    const body = scripts.join("\n");
    for (const name of names) {
      if (!new RegExp(`\\b${name}\\b`).test(body)) {
        warn(card, `配置项 "${name}" 声明后从未被读取`);
      }
    }
  }

  console.log(`  ✓ [${card}] checked (v${entry.version})`);
}

console.log(failed ? "\n✗ 检查未通过" : `\n✓ ${entries.length} 张卡片检查通过`);
process.exit(failed ? 1 : 0);
