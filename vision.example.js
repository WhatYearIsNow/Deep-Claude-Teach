#!/usr/bin/env node
/**
 * 独立识图脚本 — 调用千问 VL 模型。
 *
 * 用法:
 *   node vision.js <图片路径> [问题]
 *   node vision.js --url <图片链接> [问题]
 *
 * 前置条件:
 *   设置环境变量 DASHSCOPE_API_KEY（从 https://bailian.console.aliyun.com/ 获取）
 *   或创建 .env 文件: DASHSCOPE_API_KEY=sk-xxx
 *
 * 依赖:
 *   npm install dotenv (可选，如果有 .env 文件)
 *
 * 缓存:
 *   识图结果自动缓存到 .vision-cache/ 目录，以图片路径+问题的 SHA256 为键。
 *   同一张图相同问题 24 小时内不重复调用 API。
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const http = require("http");

try { require("dotenv").config(); } catch {}
try { require("dotenv").config({ path: path.resolve(__dirname, ".env") }); } catch {}

const BASE_URL = process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const API_KEY = process.env.DASHSCOPE_API_KEY;
const MODEL = process.env.VISION_MODEL || "qwen-vl-plus";
const MAX_TOKENS = parseInt(process.env.VISION_MAX_TOKENS || "4096", 10);
const MAX_RETRIES = parseInt(process.env.VISION_MAX_RETRIES || "3", 10);
const CACHE_DIR = path.resolve(__dirname, ".vision-cache");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function parseArgs() {
  const argv = process.argv.slice(2);
  let imageSource = "", prompt = "", isUrl = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url" && argv[i + 1]) {
      isUrl = true;
      imageSource = argv[++i];
    } else if (!imageSource && !argv[i].startsWith("--")) {
      imageSource = argv[i];
    } else if (imageSource && !argv[i].startsWith("--")) {
      prompt = prompt ? prompt + " " + argv[i] : argv[i];
    }
  }
  if (!prompt) prompt = "请详细描述这张图片的内容。";
  return { imageSource, prompt, isUrl };
}

function resolveImageUrl(source, isUrl) {
  if (isUrl) return source;
  const resolved = path.resolve(source);
  if (!fs.existsSync(resolved)) throw new Error(`文件不存在: ${resolved}`);
  const ext = path.extname(resolved).toLowerCase().replace(".", "");
  const mimeMap = { jpg: "jpeg", jpeg: "jpeg", png: "png", gif: "gif", webp: "webp", bmp: "bmp" };
  const data = fs.readFileSync(resolved);
  return `data:image/${mimeMap[ext] || "jpeg"};base64,${data.toString("base64")}`;
}

function getCacheKey(imageSource, prompt, isUrl) {
  const hash = crypto.createHash("sha256");
  hash.update(imageSource);
  hash.update(prompt);
  hash.update(isUrl ? "url" : "file");
  return hash.digest("hex");
}

function readCache(cacheKey) {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
    if (!fs.existsSync(cacheFile)) return null;
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      fs.unlinkSync(cacheFile);
      return null;
    }
    return cached.result;
  } catch { return null; }
}

function writeCache(cacheKey, result) {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, `${cacheKey}.json`), JSON.stringify({
      timestamp: Date.now(),
      result,
    }));
  } catch {}
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function request(payload, retriesLeft = MAX_RETRIES) {
  const url = new URL(BASE_URL.replace(/\/?$/, "/") + "chat/completions");
  const body = JSON.stringify(payload);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 60000,
    }, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", async () => {
        if (res.statusCode === 429 && retriesLeft > 0) {
          // Rate limited — exponential backoff
          const delay = Math.pow(2, MAX_RETRIES - retriesLeft + 1) * 1000;
          console.error(`[vision] 速率限制，${delay/1000}s 后重试 (剩余 ${retriesLeft} 次)...`);
          await sleep(delay);
          try {
            resolve(await request(payload, retriesLeft - 1));
          } catch (e) { reject(e); }
          return;
        }
        if ((res.statusCode >= 500 || res.statusCode === 429) && retriesLeft > 0) {
          const delay = Math.pow(2, MAX_RETRIES - retriesLeft + 1) * 1000;
          console.error(`[vision] 服务端错误 ${res.statusCode}，${delay/1000}s 后重试 (剩余 ${retriesLeft} 次)...`);
          await sleep(delay);
          try {
            resolve(await request(payload, retriesLeft - 1));
          } catch (e) { reject(e); }
          return;
        }
        if (res.statusCode >= 400) {
          return reject(new Error(`API ${res.statusCode}: ${data.slice(0, 500)}`));
        }
        try {
          resolve(JSON.parse(data)?.choices?.[0]?.message?.content || data);
        } catch { resolve(data); }
      });
    });
    req.on("error", async (err) => {
      if (retriesLeft > 0) {
        const delay = Math.pow(2, MAX_RETRIES - retriesLeft + 1) * 1000;
        console.error(`[vision] 网络错误: ${err.message}，${delay/1000}s 后重试 (剩余 ${retriesLeft} 次)...`);
        await sleep(delay);
        try {
          resolve(await request(payload, retriesLeft - 1));
        } catch (e) { reject(e); }
      } else {
        reject(err);
      }
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("请求超时"));
    });
    req.write(body);
    req.end();
  });
}

async function main() {
  if (!API_KEY) {
    console.error("请设置 DASHSCOPE_API_KEY 环境变量或在 .env 文件中配置。");
    console.error("获取 Key: https://bailian.console.aliyun.com/");
    process.exit(1);
  }
  const { imageSource, prompt, isUrl } = parseArgs();
  if (!imageSource) {
    console.error("用法: node vision.js <图片路径> [问题]");
    console.error("      node vision.js --url <图片链接> [问题]");
    process.exit(1);
  }

  // Check cache
  const cacheKey = getCacheKey(imageSource, prompt, isUrl);
  const cached = readCache(cacheKey);
  if (cached) {
    console.error(`[vision] 命中缓存 (${CACHE_DIR}/${cacheKey}.json)`);
    console.log(cached);
    return;
  }

  try {
    const imageUrl = resolveImageUrl(imageSource, isUrl);
    const result = await request({
      model: MODEL,
      messages: [{ role: "user", content: [
        { type: "image_url", image_url: { url: imageUrl } },
        { type: "text", text: prompt },
      ]}],
      stream: false,
      max_tokens: MAX_TOKENS,
    });
    writeCache(cacheKey, result);
    console.log(result);
  } catch (err) {
    console.error("识图失败:", err.message);
    process.exit(1);
  }
}

main();
