import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { success: false, error: "Server misconfiguration." },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("waitlist").insert({ email });

    if (error?.code === "23505") {
      return NextResponse.json(
        { success: true, message: "You're already on the list." },
        { status: 200 }
      );
    }
    if (error) {
      console.error("Waitlist insert error:", error);
      return NextResponse.json(
        { success: false, error: "Something went wrong. Try again?" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "You're in. We'll be in touch." },
      { status: 201 }
    );
  } catch (e) {
    console.error("Waitlist API error:", e);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Try again?" },
      { status: 500 }
    );
  }
}
