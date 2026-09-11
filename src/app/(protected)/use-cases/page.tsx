import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth/admin";
import UseCasesPage from "./ui";

export default async function UseCasesRoute() {
  const supabase = await createClient();
  if (!supabase) redirect("/auth?reason=configuration");
  const { user, isAdmin } = await getAdminContext(supabase);
  if (!user || !isAdmin) redirect("/dashboard");
  return <UseCasesPage />;
}
