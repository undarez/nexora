import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NexoAssistant } from "@/components/nexo/nexo-assistant";
import { NexoLiveObserver } from "@/components/nexo/nexo-live-observer";
import { AndroidInteractionLayer } from "@/components/mobile/android-interaction-layer";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import { MinimumRouteLoader } from "@/components/minimum-route-loader";
import { LiaRuntimeBootstrap } from "@/components/lia-runtime-bootstrap";
import { ProductAnalyticsTracker } from "@/components/analytics/product-analytics-tracker";
import FirstVisitGuide from "@/components/help/first-visit-guide";
import { AppTopbar } from "@/components/app-topbar";

/**
 * Hard server-side boundary for every authenticated application page.
 * This complements proxy.ts: even if a client navigation, stale build, or
 * proxy configuration bypasses the edge check, protected UI is never rendered
 * without a valid Supabase session.
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  if (!supabase) redirect("/auth?reason=configuration");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?reason=auth_required");

  const isAdmin = (process.env.ADMIN_EMAILS || "").split(",").map((v) => v.trim().toLowerCase()).includes((user.email || "").toLowerCase());

  return <div className="protected-app-shell"><LiaRuntimeBootstrap /><ProductAnalyticsTracker /><DesktopSidebar isAdmin={isAdmin} /><div className="desktop-main"><AppTopbar displayName={(user.user_metadata?.display_name as string | undefined) ?? null} email={user.email} /><div className="route-transition"><MinimumRouteLoader>{children}</MinimumRouteLoader></div></div><NexoAssistant /><NexoLiveObserver /><FirstVisitGuide userId={user.id} /><AndroidInteractionLayer /></div>;
}
