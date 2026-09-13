import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth/admin";
import VeilleAdminClient from "./ui";

export default async function Page(){
  const supabase = await createClient();
  if (!supabase) redirect("/auth?reason=configuration");
  const { user, isAdmin } = await getAdminContext(supabase);
  if (!user || !isAdmin) redirect("/dashboard");
  return <VeilleAdminClient />;
}
