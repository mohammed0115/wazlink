/**
 * The authenticated-route gate.
 *
 * It renders one of four things: a loading state while the session is being
 * resolved, a sign-in prompt when there is none, a workspace bootstrap when
 * the account has no workspace yet, or the route itself.
 *
 * This gate is convenience, not security. Every request is authorized again
 * server-side, and a user who bypasses the gate reaches an API that refuses
 * them. Nothing here grants access to anything.
 */
import { useState, type PropsWithChildren } from "react";
import { useAuth } from "../context/AuthProvider";
import { useApiAction } from "../../api/hooks";
import { go } from "../router/useHashRoute";
import { ApiLoadingState, FormError } from "./ApiStates";

function WorkspaceBootstrap() {
  const { createWorkspace, logout } = useAuth();
  const [name, setName] = useState("");
  const create = useApiAction((workspaceName: string) => createWorkspace(workspaceName));

  return (
    <section className="card crm-state-card">
      <span className="status info">خطوة أخيرة</span>
      <h2>أنشئ مساحة العمل الأولى</h2>
      <p>حسابك مفعّل، ولم تُنشأ مساحة عمل بعد. كل بيانات CRM تُحفظ داخل مساحة العمل.</p>
      <div className="form-field">
        <label htmlFor="bootstrapWorkspace">اسم مساحة العمل</label>
        <input
          id="bootstrapWorkspace"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="مثال: شركة نمو"
        />
      </div>
      <FormError error={create.error} />
      <div className="crm-state-actions">
        <button
          className="button primary"
          type="button"
          disabled={create.pending || !name.trim()}
          onClick={() => create.run(name)}
        >
          {create.pending ? "جارٍ الإنشاء…" : "إنشاء مساحة العمل"}
        </button>
        <button className="button ghost" type="button" onClick={() => logout()}>
          تسجيل الخروج
        </button>
      </div>
    </section>
  );
}

export function RequireAuth({ children }: PropsWithChildren) {
  const { status } = useAuth();

  if (status === "loading") return <ApiLoadingState title="جارٍ التحقق من الجلسة" />;

  if (status === "anonymous") {
    return (
      <section className="card crm-state-card" role="status">
        <span className="status warning">تحتاج إلى تسجيل الدخول</span>
        <h2>هذه الشاشة تعرض بيانات حقيقية من مساحة عملك.</h2>
        <p>سجّل الدخول للمتابعة.</p>
        <div className="crm-state-actions">
          <button className="button primary" type="button" onClick={() => go("login")}>
            الذهاب إلى تسجيل الدخول
          </button>
        </div>
      </section>
    );
  }

  if (status === "no_workspace") return <WorkspaceBootstrap />;

  return <>{children}</>;
}
