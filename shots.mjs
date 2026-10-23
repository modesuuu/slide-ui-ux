// CDP screenshot + state verification for the clone (Node 24, native WebSocket)
import { writeFileSync } from "node:fs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const targets = await (await fetch("http://127.0.0.1:9224/json/list")).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); }
  if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push(d.params.args.map((a) => a.value || a.description || "").join(" "));
  if (d.method === "Runtime.exceptionThrown") errors.push("EXC: " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true }); return r?.result?.value; };
await send("Runtime.enable"); await send("Page.enable");
await send("Page.navigate", { url: "file:///tmp/clone-inline.html" });
await sleep(700);
async function shot(name) { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`shots/${name}.png`, Buffer.from(r.data, "base64")); console.log("shot", name); }
await shot("01-preloader");
await sleep(2600);
await shot("02-hero");
console.log("hero state:", JSON.stringify(await ev(`({motion: document.getElementById('hero').dataset.motion, cards: document.querySelectorAll('[data-orbit-card]').length, t0: document.querySelector('[data-orbit-card]').style.transform.slice(0,60), sts: window.ScrollTrigger ? 'n/a' : 'n/a'})`)));
await sleep(3000);
console.log("orbit moved:", await ev(`document.querySelector('[data-orbit-card]').style.transform.slice(0,60)`));
await ev(`document.getElementById('home-services').scrollIntoView();`); await sleep(1400);
await shot("03-services-top");
await ev(`window.scrollBy(0, 620)`); await sleep(1600);
await shot("04-services-constellation");
console.log("services state:", JSON.stringify(await ev(`({playing: document.getElementById('servicesRoot').dataset.playing, disc: document.getElementById('servicesRoot').dataset.discipline})`)));
await ev(`document.getElementById('home-featured').scrollIntoView();`); await sleep(1200);
await shot("05-reel-start");
await ev(`window.scrollBy(0, 1500)`); await sleep(1400);
await shot("06-reel-mid");
console.log("reel state:", JSON.stringify(await ev(`({pos: document.getElementById('home-featured').dataset.reelPosition, active: document.getElementById('home-featured').dataset.activeWork, pinSpacer: !!document.querySelector('.pin-spacer'), stCount: (window.gsap && document.querySelectorAll('.pin-spacer').length)})`)));
await ev(`window.scrollBy(0, 3200)`); await sleep(1400);
await shot("07-reel-late");
await ev(`document.getElementById('home-explore').scrollIntoView()`); await sleep(1200);
await shot("08-explore");
console.log("console errors:", errors.length ? errors.slice(0, 6) : "none");
ws.close(); process.exit(0);
