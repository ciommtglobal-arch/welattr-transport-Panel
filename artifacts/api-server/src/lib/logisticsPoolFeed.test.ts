import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
const state = vi.hoisted(() => ({
  addresses:[{address:"8.8.8.8",family:4}], status:200, encoding:"identity",
  body:'{"items":[{"id":"TEST-feed","role":"buyer","name":"TEST ONLY","isTest":true}]}',
  options:null as any, requests:0,
}));
vi.mock("node:dns/promises", () => ({lookup:async()=>state.addresses.map(a=>({...a}))}));
vi.mock("node:https", () => ({request:(_url:unknown,options:any,onResponse:any) => {
  state.requests++;state.options=options;
  const req = new EventEmitter() as any;
  req.destroy=(error?:Error)=>{if(error)req.emit("error",error);req.emit("close");};
  req.end=()=>queueMicrotask(()=>{
    const response = new EventEmitter() as any;
    response.statusCode=state.status;
    response.headers={"content-type":"application/json","content-encoding":state.encoding};
    response.destroy=()=>{};
    onResponse(response);
    if(state.status===200 && state.encoding==="identity"){
      response.emit("data",Buffer.from(state.body));response.emit("end");req.emit("close");
    }
  });
  return req;
}}));
import { readPublicFeed } from "./logisticsPoolFeed";
afterEach(()=>{state.addresses=[{address:"8.8.8.8",family:4}];state.status=200;state.encoding="identity";state.requests=0;state.body='{"items":[]}';});
describe("Feed transport without any actual network",()=>{
  it("pins checked DNS and preserves HTTPS hostname verification",async()=>{
    const rows = await readPublicFeed("https://feeds.vendor.tld/pool.json");
    expect(rows[0]).toMatchObject({name:"TEST ONLY",isTest:true});
    state.addresses=[{address:"127.0.0.1",family:4}];
    const resolved = vi.fn();state.options.lookup("feeds.vendor.tld",{all:false},resolved);
    expect(resolved).toHaveBeenCalledWith(null,"8.8.8.8",4);
    expect(state.options.rejectUnauthorized).not.toBe(false);
  });
  it("rejects mixed private DNS before making an HTTPS connection",async()=>{
    state.addresses=[{address:"8.8.8.8",family:4},{address:"169.254.169.254",family:4}];
    await expect(readPublicFeed("https://feeds.vendor.tld/pool.json")).rejects.toThrow("genel ağa");
    expect(state.requests).toBe(0);
  });
  it("rejects redirects instead of following them to a private target",async()=>{
    state.status=302;await expect(readPublicFeed("https://feeds.vendor.tld/pool.json")).rejects.toThrow("200 JSON");
    expect(state.requests).toBe(1);
  });
  it("does not inflate compressed or oversized bodies",async()=>{
    state.encoding="gzip";await expect(readPublicFeed("https://feeds.vendor.tld/pool.json")).rejects.toThrow("200 JSON");
    state.encoding="identity";state.body=" ".repeat(2*1024*1024+1);
    await expect(readPublicFeed("https://feeds.vendor.tld/pool.json")).rejects.toThrow("boyut sınırı");
  });
  it("rejects invalid JSON rather than accepting an empty successful scan",async()=>{
    state.body="not-json";await expect(readPublicFeed("https://feeds.vendor.tld/pool.json")).rejects.toThrow();
  });
});
