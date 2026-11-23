"use client";

import { PlayCircle } from "lucide-react";

/**
 * Extracts the YouTube video ID from various YouTube URL formats.
 * Returns the thumbnail URL or null if not a YouTube URL.
 */
function getYouTubeThumbnail(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]+)/);
      if (m) return `https://img.youtube.com/vi/${m[2]}/hqdefault.jpg`;
    }
    return null;
  } catch {
    return null;
  }
}

interface CourseThumbnailProps {
  thumbnail: string | null;
  firstVideoUrl?: string | null;
  firstVideoSource?: string | null;
  alt: string;
  className?: string;
  /** Whether to show a play icon overlay on hover */
  showPlayOverlay?: boolean;
}

/**
 * Renders the best available thumbnail for a course card.
 *
 * Fallback order:
 * 1. Course thumbnail (custom uploaded image)
 * 2. First video's thumbnail (if the video has one)
 * 3. YouTube thumbnail (auto-generated from YouTube video URL)
 * 4. First frame of the video (via <video preload="metadata">)
 * 5. Gradient placeholder with play icon
 */
export function CourseThumbnail({
  thumbnail,
  firstVideoUrl,
  firstVideoSource,
  alt,
  className = "",
  showPlayOverlay = false,
}: CourseThumbnailProps) {
  // 1. Use image thumbnail if available
  if (thumbnail) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img
          src={thumbnail}
          alt={alt}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {showPlayOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/20 group-hover:opacity-100">
            <PlayCircle className="h-10 w-10 text-white drop-shadow-lg" />
          </div>
        )}
      </div>
    );
  }

  // 2. Try YouTube thumbnail for YouTube videos
  if (firstVideoSource === "YOUTUBE" && firstVideoUrl) {
    const ytThumb = getYouTubeThumbnail(firstVideoUrl);
    if (ytThumb) {
      return (
        <div className={`relative overflow-hidden ${className}`}>
          <img
            src={ytThumb}
            alt={alt}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {showPlayOverlay && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/20 group-hover:opacity-100">
              <PlayCircle className="h-10 w-10 text-white drop-shadow-lg" />
            </div>
          )}
        </div>
      );
    }
  }

  // 3. Use <video> element to show first frame for UPLOAD/URL videos
  if (firstVideoUrl && (firstVideoSource === "UPLOAD" || firstVideoSource === "URL")) {
    return (
      <div className={`relative overflow-hidden bg-black ${className}`}>
        <video
          src={firstVideoUrl}
          preload="metadata"
          muted
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {showPlayOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/20 group-hover:opacity-100">
            <PlayCircle className="h-10 w-10 text-white drop-shadow-lg" />
          </div>
        )}
      </div>
    );
  }

  // 4. Gradient placeholder
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 ${className}`}>
      <PlayCircle className="h-10 w-10 text-muted-foreground/40" />
    </div>
  );
}
