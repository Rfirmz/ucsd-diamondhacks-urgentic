import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userName, contactName, contactPhone } = body as {
      userName?: string;
      contactName?: string;
      contactPhone?: string;
    };
    if (!userName?.trim() || !contactName?.trim() || !contactPhone?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        user_name: userName.trim(),
        contact_name: contactName.trim(),
        contact_phone: normalizeUsPhone(contactPhone.trim()),
      })
      .select()
      .single();

    if (error) {
      console.error("contacts insert", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      userName: data.user_name,
      contactName: data.contact_name,
      contactPhone: data.contact_phone,
      createdAt: data.created_at,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("contacts").select("*").eq("id", id).single();

  if (error || !data) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    userName: data.user_name,
    contactName: data.contact_name,
    contactPhone: data.contact_phone,
    createdAt: data.created_at,
  });
}

function normalizeUsPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (input.startsWith("+")) return input.replace(/\s/g, "");
  return input.startsWith("+") ? input : `+${digits}`;
}
