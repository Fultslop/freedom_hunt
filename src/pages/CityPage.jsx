import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

export default function CityPage() {
  const { city: cityId } = useParams();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [expandedLocation, setExpandedLocation] = useState(null);

  useEffect(() => {
    setData(null);
    setNotFound(false);
    setExpandedLocation(null);
    import(`../data/${cityId}.json`)
      .then(module => setData(module.default))
      .catch(() => setNotFound(true));
  }, [cityId]);

  if (notFound) {
    return (
      <div style={{
        fontFamily: "'Lora', Georgia, serif",
        background: "#0a0a0a",
        minHeight: "100vh",
        color: "#e8e0d0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 32,
      }}>
        <style>{`html,body,#root{margin:0;padding:0;background:#0a0a0a;} *{box-sizing:border-box;}`}</style>
        <div style={{ fontSize: 48 }}>🗺️</div>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#c4952a", margin: 0 }}>
          City not found
        </h1>
        <p style={{ color: "#888", margin: 0 }}>
          There's no hunt planned for <strong style={{ color: "#e8e0d0" }}>{cityId}</strong> yet.
        </p>
        <Link to="/" style={{
          marginTop: 8,
          color: "#c4952a",
          textDecoration: "none",
          fontSize: 14,
          borderBottom: "1px solid #c4952a",
          paddingBottom: 2,
        }}>
          ← Back to all cities
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        fontFamily: "'Lora', Georgia, serif",
        background: "#0a0a0a",
        minHeight: "100vh",
        color: "#888",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <style>{`html,body,#root{margin:0;padding:0;background:#0a0a0a;} *{box-sizing:border-box;}`}</style>
        Loading…
      </div>
    );
  }

  const { city, locations } = data;
  const totalPoints = locations.reduce((s, l) => s + l.points, 0);

  return (
    <div style={{
      fontFamily: "'Lora', Georgia, serif",
      background: "#0a0a0a",
      minHeight: "100vh",
      color: "#e8e0d0",
      margin: 0,
      padding: 0,
    }}>
      <style>{`
        html, body, #root {
          margin: 0; padding: 0;
          background: #0a0a0a;
          min-height: 100vh;
          font-family: 'Lora', Georgia, serif;
        }
        * { box-sizing: border-box; }
        button { font-family: 'Lora', Georgia, serif; }
        h1, h2, h3 { font-family: 'Playfair Display', Georgia, serif; }
      `}</style>

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a0a00 0%, #0d1a2e 50%, #1a000d 100%)",
        borderBottom: "2px solid #c4952a",
        padding: "32px 32px 28px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: "radial-gradient(circle at 20% 50%, rgba(196,149,42,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(30,80,160,0.1) 0%, transparent 40%)",
        }} />
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto" }}>
          <Link to="/" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#666",
            textDecoration: "none",
            fontSize: 13,
            marginBottom: 20,
            transition: "color 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.color = "#c4952a"}
            onMouseLeave={e => e.currentTarget.style.color = "#666"}
          >
            ← All cities
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <span style={{ fontSize: 40 }}>{city.flag}</span>
            <div>
              <h1 style={{
                fontSize: "clamp(24px, 4vw, 40px)",
                fontWeight: 700,
                margin: "0 0 4px",
                lineHeight: 1.1,
                letterSpacing: "-0.5px",
                fontFamily: "'Playfair Display', Georgia, serif",
              }}>
                {city.name} Freedom Hunt
              </h1>
              <div style={{ fontSize: 13, color: "#666", letterSpacing: 0.5 }}>{city.country}</div>
            </div>
          </div>

          <p style={{
            fontSize: 14,
            color: "#aaa",
            margin: "0 0 20px",
            maxWidth: 640,
            lineHeight: 1.7,
          }}>
            {city.description}
          </p>

          {locations.length > 0 ? (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                [city.totalLocations.toString(), "Locations"],
                [totalPoints.toLocaleString(), "Total Points"],
                [city.walkTime, "Walk Time"],
                ["3min", "To Register"],
              ].map(([val, label]) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#c4952a", lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              display: "inline-block",
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 6,
              padding: "8px 16px",
              fontSize: 13,
              color: "#666",
              fontStyle: "italic",
            }}>
              Locations being planned by the local Democrats Abroad chapter
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>

        {/* Suggested route */}
        {locations.length > 0 && (
          <div style={{
            background: "#111",
            border: "1px solid #c4952a",
            borderRadius: 8,
            padding: 16,
            marginBottom: 28,
            fontSize: 13,
            color: "#aaa",
          }}>
            <strong style={{ color: "#c4952a" }}>Suggested Route:</strong> {city.suggestedRoute}
          </div>
        )}

        {/* Locations */}
        {locations.length > 0 ? (
          <>
            <p style={{ color: "#888", fontStyle: "italic", marginBottom: 24, fontSize: 14 }}>
              {city.totalLocations} stops designed as a roughly {city.walkTime} walk, all accessible by public transit. Click any stop to expand its full brief.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {locations.map(loc => (
                <LocationCard
                  key={loc.id}
                  loc={loc}
                  expanded={expandedLocation === loc.id}
                  onToggle={() => setExpandedLocation(expandedLocation === loc.id ? null : loc.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <div style={{
            textAlign: "center",
            padding: "60px 24px",
            color: "#444",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏗️</div>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#666", marginBottom: 8 }}>
              Hunt Under Construction
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 400, margin: "0 auto" }}>
              The local Democrats Abroad chapter is working on the {city.name} Freedom Hunt.
              Check back soon or{" "}
              <a href="https://www.democratsabroad.org" target="_blank" rel="noreferrer"
                style={{ color: "#c4952a", textDecoration: "none" }}>
                join Democrats Abroad
              </a>{" "}
              to get notified when it launches.
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: "1px solid #1a1a1a",
          textAlign: "center",
          color: "#444",
          fontSize: 12,
        }}>
          <p>The {city.name} Freedom Hunt — Democrats Abroad {city.country}</p>
          <p style={{ color: "#c4952a", marginTop: 8 }}>VoteFromAbroad.org | democratsabroad.org</p>
        </div>
      </div>
    </div>
  );
}

function LocationCard({ loc, expanded, onToggle }) {
  return (
    <div style={{
      background: expanded ? "#131313" : "#0e0e0e",
      border: `1px solid ${expanded ? "#c4952a" : "#222"}`,
      borderRadius: 8,
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", background: "none", border: "none",
          padding: "16px 20px", cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", gap: 16,
        }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: loc.isFinal ? "#c4952a" : "#1a1a1a",
          border: `2px solid ${loc.isFinal ? "#c4952a" : "#444"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700, color: loc.isFinal ? "#000" : "#888",
          flexShrink: 0,
        }}>
          {loc.id}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, color: "#e8e0d0", fontSize: 15 }}>{loc.name}</span>
            <span style={{ fontSize: 11, color: "#666", letterSpacing: 0.5 }}>{loc.neighborhood}</span>
          </div>
          <div style={{ fontSize: 12, color: loc.themeColor || "#888", marginTop: 2 }}>
            {loc.theme}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ fontSize: 20 }}>{loc.badge.split(" ")[0]}</div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#c4952a" }}>{loc.points}</div>
            <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase" }}>pts</div>
          </div>
          <span style={{ color: "#444", fontSize: 18 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: "0 20px 20px", borderTop: "1px solid #1e1e1e" }}>
          <div style={{ marginTop: 16 }}>
            <Label>📍 Location</Label>
            <p style={{ color: "#aaa", fontSize: 13 }}>{loc.coords} — {loc.neighborhood}</p>
          </div>
          <div>
            <Label>🧩 The Clue</Label>
            <p style={{ color: "#ddd", fontStyle: "italic", fontSize: 14, lineHeight: 1.7, borderLeft: `3px solid ${loc.themeColor || "#555"}`, paddingLeft: 12 }}>
              {loc.clue}
            </p>
          </div>
          <div>
            <Label>🏛️ Historical Context</Label>
            <p style={{ color: "#aaa", fontSize: 13, lineHeight: 1.7 }}>{loc.historicalHook}</p>
          </div>
          <div>
            <Label>🇺🇸 American Connection</Label>
            <p style={{ color: "#aaa", fontSize: 13, lineHeight: 1.7 }}>{loc.americanConnection}</p>
          </div>
          <div>
            <Label>📸 The Challenge</Label>
            <p style={{ color: "#ccc", fontSize: 13, lineHeight: 1.7, background: "#1a1a1a", padding: 12, borderRadius: 6 }}>{loc.challenge}</p>
          </div>
          <div>
            <Label>🗳️ Voting Bridge</Label>
            <p style={{ color: "#c4952a", fontSize: 13, lineHeight: 1.7, fontWeight: 600 }}>{loc.votingBridge}</p>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 24 }}>{loc.badge.split(" ")[0]}</span>
            <span style={{ color: "#888", fontSize: 13 }}>Badge earned: <strong style={{ color: "#ddd" }}>{loc.badge}</strong></span>
            <span style={{ marginLeft: "auto", background: "#1e1a10", border: "1px solid #c4952a", borderRadius: 20, padding: "4px 12px", color: "#c4952a", fontSize: 13, fontWeight: 700 }}>
              +{loc.points} pts
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      color: "#666",
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginTop: 16,
      marginBottom: 6,
    }}>{children}</div>
  );
}
