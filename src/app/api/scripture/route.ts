import { NextRequest, NextResponse } from "next/server";

// Looks up a Bible passage's text by reference (e.g. "John 3:16") using the
// free, keyless bible-api.com. Requires outbound internet access from
// wherever this app is deployed — if that's unavailable, the caller falls
// back to typing the verse text in by hand.
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref");
  if (!ref || !ref.trim()) {
    return NextResponse.json({ error: "A reference is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://bible-api.com/${encodeURIComponent(ref.trim())}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Couldn't find that reference. Check the format, e.g. \"John 3:16\"." },
        { status: 404 }
      );
    }
    const data = await res.json();
    if (!data.text) {
      return NextResponse.json({ error: "No text returned for that reference." }, { status: 404 });
    }
    return NextResponse.json({
      reference: data.reference ?? ref.trim(),
      text: String(data.text).trim(),
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach the scripture lookup service. You can type the verse in manually." },
      { status: 502 }
    );
  }
}
