import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth/admin";
import AdminSystemClient from "./ui";

export default async function AdminSystemPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/");
  const { user, isAdmin } = await getAdminContext(supabase);
  if (!user || !isAdmin) redirect("/");
  return <AdminSystemClient />;
}
