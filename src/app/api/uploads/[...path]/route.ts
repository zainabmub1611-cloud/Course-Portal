import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { readUploadedFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

function buildDownloadDisposition(preferredName: string): string {
  const safeOriginal = preferredName.replace(/[\r\n"/\\]/g, "_").trim() || "download";
  const asciiFallback =
    safeOriginal.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "download";
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeOriginal)}`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const relPath = `/api/uploads/${segments.map((s) => encodeURIComponent(s)).join("/")}`;
    const stored = await readUploadedFile(relPath, { skipBufferIfOnDisk: true });
    if (!stored) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const totalSize = stored.size;
    const contentType = stored.mimeType || "application/octet-stream";

    const url = new URL(req.url);
    const forceDownload = url.searchParams.get("download") === "1";
    const requestedName = url.searchParams.get("filename")?.trim();
    const preferredName =
      requestedName ||
      stored.originalName ||
      (stored.filePath ? path.basename(stored.filePath) : segments[segments.length - 1] || "file");

    const commonHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": forceDownload
        ? "no-store, must-revalidate"
        : "public, max-age=31536000, immutable",
    };

    if (forceDownload) {
      commonHeaders["Content-Disposition"] = buildDownloadDisposition(preferredName);
    }

    const rangeHeader = req.headers.get("range");
    if (rangeHeader && totalSize > 0) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2]
          ? Math.min(parseInt(match[2], 10), totalSize - 1)
          : totalSize - 1;

        if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end && start < totalSize) {
          const chunkSize = end - start + 1;
          if (stored.filePath) {
            const handle = await fs.open(stored.filePath, "r");
            try {
              const buf = Buffer.allocUnsafe(chunkSize);
              await handle.read(buf, 0, chunkSize, start);
              return new Response(new Uint8Array(buf), {
                status: 206,
                headers: {
                  ...commonHeaders,
                  "Content-Range": `bytes ${start}-${end}/${totalSize}`,
                  "Content-Length": String(chunkSize),
                },
              });
            } finally {
              await handle.close();
            }
          } else if (stored.buffer) {
            const slice = stored.buffer.subarray(start, end + 1);
            return new Response(new Uint8Array(slice), {
              status: 206,
              headers: {
                ...commonHeaders,
                "Content-Range": `bytes ${start}-${end}/${totalSize}`,
                "Content-Length": String(slice.length),
              },
            });
          }
        }
      }
    }

    const fileBuf =
      stored.buffer ?? (stored.filePath ? await fs.readFile(stored.filePath) : Buffer.alloc(0));
    return new Response(new Uint8Array(fileBuf), {
      status: 200,
      headers: {
        ...commonHeaders,
        "Content-Length": String(fileBuf.length),
      },
    });
  } catch (e) {
    console.error("[api/uploads GET]", e);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}

