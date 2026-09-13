import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/auth?message=invalid", url.origin));
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/auth?message=config", url.origin));
  }

  const { error } = await supabase.auth.verifyOtp({
    type: type as "email" | "magiclink",
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(new URL(`/auth?message=error`, url.origin));
  }

  return NextResponse.redirect(new URL("/onboarding", url.origin));
}
