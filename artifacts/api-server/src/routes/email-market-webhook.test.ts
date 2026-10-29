import express from "express";
import request from "supertest";
import { Webhook } from "svix";
import { describe,it,expect,beforeEach,afterEach,vi } from "vitest";
const mocks = vi.hoisted(() => ({select:vi.fn(),process:vi.fn()}));
vi.mock("@workspace/db", () => ({db:{select:mocks.select},logisticsPoolSourcesTable:{id:"id"}}));
vi.mock("../lib/marketFeedService", () => ({processMarketFeedText:mocks.process}));
import router from "./email-market-webhook";
const secret = "whsec_"+Buffer.from("only-a-local-test-signing-secret-123").toString("base64");
const source = {id:"11111111-1111-4111-8111-111111111111",url:"market://source/welattr-email",
  enabled:true,consentBy:"test-founder",consentAt:new Date()};
const app = express();
app.use(express.raw({type:"application/json",limit:"256kb"}));
app.use((req,_res,next) => {req.log={warn:vi.fn()} as any; next();},router);
const event = () => ({type:"event",event_type:"message.received",message:{
  inbox_id:"lojistik@welattr.com",message_id:"mail-123",created_at:new Date().toISOString(),
  extracted_text:"İstanbul Tuzla'dan Ankara Ostim'e 20 ton paletli yük, tenteli bugün",
}});
function send(body:unknown, id="test-event", at=new Date(), tamper=false) {
  const raw=JSON.stringify(body);
  return request(app).post("/webhook/email").set("Content-Type","application/json")
    .set("svix-id",id).set("svix-timestamp",String(Math.floor(at.getTime()/1000)))
    .set("svix-signature",new Webhook(secret).sign(id,at,raw)).send(tamper?raw+" ":raw);
}
describe("signed, receive-only logistics email bridge", () => {
  beforeEach(() => {
    vi.stubEnv("AGENTMAIL_WEBHOOK_SECRET",secret);
    vi.stubEnv("MMT_EMAIL_INBOX","lojistik@welattr.com");
    vi.stubEnv("MMT_EMAIL_SOURCE_ID",source.id);
    mocks.select.mockReturnValue({from:()=>({where:async()=>[source]})});
    mocks.process.mockReset().mockResolvedValue({status:"accepted",messagesSent:false});
  });
  afterEach(()=>vi.unstubAllEnvs());
  it("fails closed until configured",async()=>{
    vi.stubEnv("AGENTMAIL_WEBHOOK_SECRET","");
    expect((await send(event())).status).toBe(503);
    expect(mocks.process).not.toHaveBeenCalled();
  });
  it("rejects altered or stale signatures",async()=>{
    expect((await send(event(),"evt",new Date(),true)).status).toBe(401);
    expect((await send(event(),"evt",new Date(Date.now()-600000))).status).toBe(401);
    expect(mocks.process).not.toHaveBeenCalled();
  });
  it("rejects wrong mailbox, disabled sources and old messages",async()=>{
    const other=event();other.message.inbox_id="other@welattr.com";
    expect((await send(other)).status).toBe(403);
    const old=event();old.message.created_at="2020-01-01T00:00:00Z";
    expect((await send(old)).status).toBe(400);
    mocks.select.mockReturnValue({from:()=>({where:async()=>[{...source,enabled:false}]})});
    expect((await send(event())).status).toBe(403);
    expect(mocks.process).not.toHaveBeenCalled();
  });
  it("ignores outbound/spam events and does not claim body-less ingestion",async()=>{
    expect((await send({...event(),event_type:"message.sent"})).body.status).toBe("ignored");
    expect((await send({...event(),event_type:"message.received.spam"})).body.status).toBe("ignored");
    const empty=event();empty.message.extracted_text="";
    expect((await send(empty)).status).toBe(503);
    expect(mocks.process).not.toHaveBeenCalled();
  });
  it("uses the same parser and stable message identity across delivery IDs",async()=>{
    const body=event();
    expect((await send(body,"evt1")).body.messagesSent).toBe(false);
    mocks.process.mockResolvedValue({status:"duplicate",messagesSent:false});
    expect((await send(body,"evt2")).body.status).toBe("duplicate");
    const a=mocks.process.mock.calls[0],b=mocks.process.mock.calls[1];
    expect(a[1]).toBe(b[1]);
    expect(a[2]).toContain("İstanbul Tuzla");
    expect(a[3].toISOString()).toBe(body.message.created_at);
  });
});
