import express from "express";
import request from "supertest";
import {beforeEach,it,expect,vi} from "vitest";
const mock=vi.hoisted(()=>({authorized:true,save:vi.fn()}));
vi.mock("../lib/logisticsWorkflowAuth",()=>({
  requireLogisticsOperator:vi.fn(),
  requireLogisticsFounder:(_req:any,res:any)=>{
    if(!mock.authorized){res.status(403).json({error:"forbidden"});return null;}
    return {userId:"test-founder",isFounder:true};
  },
}));
vi.mock("../lib/logisticsPool",()=>({importCopiedMarketAds:mock.save,getPoolWorkspace:vi.fn(),actOnPool:vi.fn()}));
import router from "./logistics-pool";
const app=express();app.use(express.json(),router);
const body={requestId:"11111111-1111-4111-8111-111111111111",channel:"whatsapp",sourceName:"TEST channel",occurredAt:new Date().toISOString(),text:"TEST Kızıltepe",consentConfirmed:true};
beforeEach(()=>{mock.authorized=true;mock.save.mockReset().mockResolvedValue({
  sourceId:"22222222-2222-4222-8222-222222222222",savedCount:0,duplicateCount:0,items:[],messagesSent:false,approvalGranted:false,
});});
it("denies nonfounders without persistence",async()=>{
  mock.authorized=false;
  expect((await request(app).post("/logistics/pool/copied-ads").send(body)).status).toBe(403);
  expect(mock.save).not.toHaveBeenCalled();
});
it("validates input and rejects injected approval fields",async()=>{
  expect((await request(app).post("/logistics/pool/copied-ads").send({...body,approved:true})).status).toBe(400);
  expect((await request(app).post("/logistics/pool/copied-ads").send({...body,text:""})).status).toBe(400);
  expect(mock.save).not.toHaveBeenCalled();
});
it("passes actor and validated input with no secret needed in the browser",async()=>{
  const res=await request(app).post("/logistics/pool/copied-ads").send(body);
  expect(res.status).toBe(200);expect(res.body.messagesSent).toBe(false);
  expect(mock.save).toHaveBeenCalledWith({...body,occurredAt:new Date(body.occurredAt)},{userId:"test-founder",isFounder:true});
});
