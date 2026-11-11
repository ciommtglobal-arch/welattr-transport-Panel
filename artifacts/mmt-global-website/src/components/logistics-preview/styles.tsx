export const LP_CSS = `
.lp{--ink:215 35% 14%;--paper:38 30% 94%;--card:40 35% 98%;--line:36 18% 82%;--accent:21 85% 45%;--teal:190 45% 24%;--warn:42 90% 90%;--mut:215 12% 38%;
min-height:100dvh;background:hsl(var(--paper));color:hsl(var(--ink));font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:15px;line-height:1.5}
.lp *{box-sizing:border-box}.lp[dir=rtl]{font-family:'Plus Jakarta Sans','Segoe UI',Tahoma,sans-serif}
.lp h1,.lp h2,.lp h3,.lp p{margin:0}
.lp-banner{position:sticky;top:0;z-index:30;background:hsl(var(--warn));border-bottom:2px solid hsl(var(--accent));padding:8px 14px;font-size:12.5px}
.lp-banner b{font-family:'Space Mono',monospace;letter-spacing:.06em;color:hsl(var(--accent))}
.lp-banner ul{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px;font-weight:600}
.lp-banner p{margin-top:4px;color:hsl(var(--mut))}
.lp-head{background:hsl(var(--teal));color:#f6f1e8;padding:14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}
.lp-head img{height:34px;display:block;background:transparent}
.lp-head h1{font-size:18px;font-weight:700;letter-spacing:.04em}.lp-head small{opacity:.8}
.lp-langs{display:flex;gap:4px;flex-wrap:wrap}
.lp-langs button{min-height:36px;min-width:40px;border:1px solid #f6f1e855;background:transparent;color:inherit;font:600 12px 'Space Mono',monospace;cursor:pointer}
.lp-langs button[aria-pressed=true]{background:#f6f1e8;color:hsl(var(--teal))}
.lp-shell{display:grid;grid-template-columns:1fr;gap:0}
.lp-nav{background:hsl(var(--card));border-bottom:1px solid hsl(var(--line));padding:10px 14px}
.lp-nav label{font-size:12px;font-weight:700;display:block;margin-bottom:4px}
.lp-navlist{display:none;list-style:none;margin:0;padding:0}
.lp-main{padding:16px 14px 48px;max-width:980px;width:100%}
.lp-btn,.lp-in,.lp-sel,.lp-ta{font:inherit;min-height:44px;border:1.5px solid hsl(var(--ink)/.35);background:#fffdf8;color:inherit;padding:8px 12px;border-radius:2px;width:100%}
.lp-ta{min-height:96px;resize:vertical}
.lp-in:focus-visible,.lp-sel:focus-visible,.lp-ta:focus-visible,.lp-btn:focus-visible,.lp a:focus-visible,.lp button:focus-visible{outline:3px solid hsl(var(--accent));outline-offset:2px}
.lp-btn{width:auto;cursor:pointer;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none}
.lp-btn.pri{background:hsl(var(--accent));border-color:hsl(var(--accent));color:#fff}
.lp-btn.dark{background:hsl(var(--teal));border-color:hsl(var(--teal));color:#fff}
.lp-btn[disabled]{opacity:.55;cursor:not-allowed;background:hsl(var(--line)/.5);color:hsl(var(--mut))}
.lp-card{background:hsl(var(--card));border:1px solid hsl(var(--line));padding:14px;margin-bottom:12px}
.lp-h2{font-size:21px;font-weight:700;margin-bottom:4px}
.lp-mut{color:hsl(var(--mut));font-size:13px}
.lp-grid{display:grid;gap:10px;grid-template-columns:1fr 1fr}
.lp-stat{border-inline-start:4px solid hsl(var(--accent));padding:6px 10px;background:hsl(var(--card))}
.lp-stat b{font:700 24px 'Space Mono',monospace;display:block}
.lp-field{margin-bottom:12px}.lp-field label{display:block;font-weight:700;font-size:13px;margin-bottom:4px}
.lp-req{color:hsl(var(--accent));font-weight:600}
.lp-err{background:#fbe4de;border:1.5px solid #b3321c;color:#6d1a0c;padding:10px 12px;margin:10px 0;font-weight:600}
.lp-ok{background:#dcefe6;border:1.5px solid #2c7a57;color:#134330;padding:10px 12px;margin:10px 0;font-weight:600}
.lp-badge{display:inline-block;font:700 11px 'Space Mono',monospace;padding:2px 8px;border:1px solid hsl(var(--ink)/.4);text-transform:uppercase}
.lp-badge.rv{background:hsl(var(--teal));color:#fff;border-color:hsl(var(--teal))}
.lp-badge.prep{background:hsl(var(--warn));border-color:hsl(var(--accent))}
.lp-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.lp-item{display:block;width:100%;text-align:start;background:hsl(var(--card));border:1px solid hsl(var(--line));padding:12px;margin-bottom:8px;cursor:pointer;font:inherit;color:inherit}
.lp-item:hover{border-color:hsl(var(--accent))}
.lp-stages{display:flex;gap:0;margin:10px 0;flex-wrap:wrap}
.lp-stages span{flex:1;min-width:90px;text-align:center;padding:8px 4px;border:1px solid hsl(var(--line));font:700 11px 'Space Mono',monospace}
.lp-stages .on{background:hsl(var(--teal));color:#fff}.lp-stages .off{background:repeating-linear-gradient(135deg,transparent 0 6px,hsl(var(--line)/.6) 6px 8px);color:hsl(var(--mut))}
.lp-empty{border:2px dashed hsl(var(--line));padding:28px 16px;text-align:center;background:hsl(var(--card))}
.lp-hist{list-style:none;padding:0;margin:0}.lp-hist li{padding:6px 0;border-bottom:1px solid hsl(var(--line));display:flex;justify-content:space-between;gap:8px;font-size:13px}
.lp dl{margin:0;display:grid;gap:8px}.lp dt{font-size:12px;font-weight:700;color:hsl(var(--mut))}.lp dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.lp-foot{margin-top:24px;padding-top:12px;border-top:1px solid hsl(var(--line))}
.lp-foot a{color:hsl(var(--teal));font-weight:700;margin-inline-end:14px;display:inline-block;padding:8px 0}
@media(min-width:820px){.lp-shell{grid-template-columns:260px 1fr}.lp-nav{border-bottom:0;border-inline-end:1px solid hsl(var(--line));min-height:70vh}
.lp-nav .lp-mobsel{display:none}.lp-navlist{display:block}
.lp-navlist button{width:100%;text-align:start;background:none;border:0;border-inline-start:3px solid transparent;padding:10px 10px;font:inherit;font-weight:600;cursor:pointer;color:inherit;display:flex;justify-content:space-between}
.lp-navlist button[aria-current=true]{border-inline-start-color:hsl(var(--accent));background:hsl(var(--accent)/.1)}
.lp-main{padding:24px 28px 60px}.lp-grid{grid-template-columns:repeat(4,1fr)}}
@media(prefers-reduced-motion:no-preference){.lp-main>*{animation:lpin .3s ease-out both}@keyframes lpin{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}}
`;
