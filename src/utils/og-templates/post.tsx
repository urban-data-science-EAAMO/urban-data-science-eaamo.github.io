import satori from "satori";
import type { CollectionEntry } from "astro:content";
import { SITE } from "@config";
import loadGoogleFonts, { type FontOptions } from "../loadGoogleFont";

export default async (post: CollectionEntry<"blog">) => {
  return satori(
    <div
      style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background pattern */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%)",
        }}
      />

      {/* Main content container */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          borderRadius: "16px",
          padding: "40px",
          margin: "40px",
          width: "1120px",
          height: "550px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
          backdropFilter: "blur(10px)",
        }}
      >
        {/* Title section */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <h1
            style={{
              fontSize: 64,
              fontWeight: "bold",
              color: "#1a202c",
              lineHeight: 1.2,
              margin: 0,
              textAlign: "center",
              maxHeight: "70%",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
            }}
          >
            {post.data.title}
          </h1>
        </div>

        {/* Bottom section with author and site info */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: "40px",
            paddingTop: "20px",
            borderTop: "2px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <span
              style={{
                fontSize: 24,
                color: "#718096",
                marginBottom: "4px",
              }}
            >
              by
            </span>
            <span
              style={{
                fontSize: 28,
                fontWeight: "bold",
                color: "#2d3748",
              }}
            >
              {post.data.author}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <span
              style={{
                fontSize: 24,
                color: "#718096",
                marginBottom: "4px",
              }}
            >
              {new URL(SITE.website).hostname}
            </span>
            <span
              style={{
                fontSize: 28,
                fontWeight: "bold",
                color: "#2d3748",
              }}
            >
              {SITE.title}
            </span>
          </div>
        </div>

        {/* Tags if available */}
        {post.data.tags && post.data.tags.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "20px",
              justifyContent: "center",
            }}
          >
            {post.data.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: 16,
                  fontWeight: "500",
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      embedFont: true,
      fonts: (await loadGoogleFonts(
        post.data.title + post.data.author + SITE.title + "by"
      )) as FontOptions[],
    }
  );
};
