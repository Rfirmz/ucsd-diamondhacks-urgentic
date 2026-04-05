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

const MAX_IDS = 24;

function mapContact(row: {
  id: string;
  user_name: string;
  contact_name: string;
  contact_phone: string;
  created_at: string;
}) {
  return {
    id: row.id,
    userName: row.user_name,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    createdAt: row.created_at,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids");
  const id = url.searchParams.get("id");

  const supabase = createServiceRoleClient();

  if (idsParam !== null) {
    const ids = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ contacts: [] });
    }
    if (ids.length > MAX_IDS) {
      return NextResponse.json({ error: "Too many ids" }, { status: 400 });
    }
    const { data, error } = await supabase.from("contacts").select("*").in("id", ids);
    if (error) {
      console.error("contacts batch", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const order = new Map(ids.map((uuid, i) => [uuid, i]));
    const list = (data ?? []).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return NextResponse.json({ contacts: list.map(mapContact) });
  }

  if (!id) {
    return NextResponse.json({ error: "Missing id or ids" }, { status: 400 });
  }

  const { data, error } = await supabase.from("contacts").select("*").eq("id", id).single();

  if (error || !data) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  return NextResponse.json(mapContact(data));
}

function normalizeUsPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (input.startsWith("+")) return input.replace(/\s/g, "");
  return input.startsWith("+") ? input : `+${digits}`;
}
