import type { B2BCompanyMember, B2BCompanyTask } from "@workspace/db";

type MemberView = Pick<B2BCompanyMember, "id" | "role" | "areas" | "leadMemberId" | "isPilotAssistant">;
type TaskView = Pick<B2BCompanyTask, "assigneeMemberId" | "area">;

export function canViewCompanyMember(viewer: MemberView, memberId: number) {
  return !viewer.isPilotAssistant ||
    viewer.id === memberId ||
    (viewer.leadMemberId !== null && viewer.leadMemberId === memberId);
}

export function canViewCompanyTask(viewer: MemberView, task: TaskView) {
  if (viewer.isPilotAssistant) return task.assigneeMemberId === viewer.id;
  if (viewer.role === "owner" || viewer.role === "admin" || viewer.role === "manager") {
    return true;
  }
  if (task.assigneeMemberId === viewer.id) return true;
  return viewer.areas.includes(task.area);
}