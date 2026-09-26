import { describe, expect, it } from "vitest";
import { canViewCompanyMember, canViewCompanyTask } from "./companyDelegation";

const leader = { id: 5, role: "manager" as const, areas: ["lojistik"], leadMemberId: null, isPilotAssistant: false };
const assistant = { id: 6, role: "member" as const, areas: ["lojistik"], leadMemberId: leader.id, isPilotAssistant: true };
const member = { id: 7, role: "member" as const, areas: ["lojistik"], leadMemberId: null, isPilotAssistant: false };

describe("pilot assistant delegation", () => {
  it("lets the leader oversee company tasks", () => {
    expect(canViewCompanyTask(leader, { assigneeMemberId: member.id, area: "finans" })).toBe(true);
  });

  it("limits a pilot assistant to assigned tasks instead of every task in their area", () => {
    expect(canViewCompanyTask(assistant, { assigneeMemberId: assistant.id, area: "lojistik" })).toBe(true);
    expect(canViewCompanyTask(assistant, { assigneeMemberId: member.id, area: "lojistik" })).toBe(false);
    expect(canViewCompanyTask(member, { assigneeMemberId: leader.id, area: "lojistik" })).toBe(true);
  });

  it("limits the pilot assistant directory to self and their leader", () => {
    expect(canViewCompanyMember(assistant, assistant.id)).toBe(true);
    expect(canViewCompanyMember(assistant, leader.id)).toBe(true);
    expect(canViewCompanyMember(assistant, member.id)).toBe(false);
  });
  it("fails closed if an assistant's leader link is absent", () => {
    const unlinked = { ...assistant, leadMemberId: null };
    expect(canViewCompanyMember(unlinked, member.id)).toBe(false);
    expect(canViewCompanyTask(unlinked, { assigneeMemberId: member.id, area: "lojistik" })).toBe(false);
  });
});