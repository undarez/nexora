import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/auth?message=error", url.origin));
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/auth?message=config", url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/auth?message=error", url.origin));
  }

  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
