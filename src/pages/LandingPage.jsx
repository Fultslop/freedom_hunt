import { useState } from "react";
import { Link } from "react-router-dom";
import cities from "../data/cities.json";

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "mechanics", label: "Game Mechanics" },
    { id: "technical", label: "Technical Spec" },
    { id: "content", label: "Voting Integration" },
    { id: "cities", label: "Cities" },
  ];

  return (
    <div style={{
      fontFamily: "'Lora', Georgia, serif",
      background: "#0a0a0a",
      minHeight: "100vh",
      color: "#e8e0d0",
      margin: 0,
      padding: 0,
      boxSizing: "border-box",
    }}>
      <style>{`
        html, body, #root {
          margin: 0;
          padding: 0;
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
        padding: "40px 32px 32px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: "radial-gradient(circle at 20% 50%, rgba(196,149,42,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(30,80,160,0.1) 0%, transparent 40%)",
        }} />
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <span style={{ fontSize: 32 }}>🇺🇸</span>
            <span style={{ fontSize: 28, color: "#c4952a" }}>✕</span>
            <span style={{ fontSize: 32 }}>🌍</span>
            <span style={{ fontSize: 28, color: "#c4952a" }}>✕</span>
            <span style={{ fontSize: 32 }}>🗳️</span>
          </div>
          <h1 style={{
            fontSize: "clamp(28px, 5vw, 48px)",
            fontWeight: 700,
            margin: "0 0 8px",
            lineHeight: 1.1,
            letterSpacing: "-0.5px",
            fontFamily: "'Playfair Display', Georgia, serif",
          }}>
            The Freedom Hunt
          </h1>
          <p style={{
            fontSize: 18,
            color: "#c4952a",
            margin: "0 0 16px",
            fontStyle: "italic",
            fontFamily: "'Lora', Georgia, serif",
          }}>
            A Democrats Abroad voter registration scavenger hunt
          </p>
          <p style={{
            fontSize: 14,
            color: "#888",
            margin: 0,
            maxWidth: 600,
            lineHeight: 1.6,
          }}>
            Inspired by Zohran Mamdani's NYC scavenger hunt — historical locations across European cities connecting the fight against fascism, American democratic history, and your power to vote from abroad.
          </p>
          <div style={{
            display: "flex", gap: 24, marginTop: 24, flexWrap: "wrap",
          }}>
            {[
              [cities.filter(c => c.status === "active").length.toString(), "Active Cities"],
              [cities.reduce((s, c) => s + c.locationCount, 0).toString(), "Total Locations"],
              ["3min", "To Register"],
            ].map(([val, label]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#c4952a", lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Nav Tabs */}
      <div style={{
        background: "#111",
        borderBottom: "1px solid #333",
        display: "flex",
        gap: 0,
        overflowX: "auto",
        maxWidth: "100%",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", width: "100%" }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid #c4952a" : "2px solid transparent",
                color: activeTab === tab.id ? "#c4952a" : "#888",
                padding: "14px 20px",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "'Lora', Georgia, serif",
                fontWeight: activeTab === tab.id ? 700 : 400,
                letterSpacing: 0.5,
                whiteSpace: "nowrap",
                transition: "color 0.2s",
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div>
            <Section title="What Is This?">
              <p>The Freedom Hunt is a digitally-run scavenger hunt across several European cities, promoting US Voter Registration. Run by Democrats Abroad chapters, it is designed to drive voter registration while building community, political consciousness, and genuine fun.</p>
              <p>Inspired by <strong style={{ color: "#c4952a" }}>Zohran Mamdani's August 2025 NYC scavenger hunt</strong> — which drew thousands overnight from a single social post, got 2 million views, and was credited as part of his path to winning the NYC mayoral race — this version is built for the expat context: longer lead time, digital tools, and a deeper historical curriculum.</p>
            </Section>

            <Section title="The Mamdani Model — What We're Adapting">
              <ul style={{ paddingLeft: 20, lineHeight: 2, color: "#ccc" }}>
                <li>Announced via social media the night before — creates urgency and buzz</li>
                <li>Clues dropped in sequence, all public-transit accessible</li>
                <li>Part walking tour, part history lesson</li>
                <li>Competitive element (first to finish wins) but also social/communal</li>
                <li>Final stop: meet the campaign / organizers + chai + photos</li>
                <li>Physical merchandise only earnable through participation (not purchasable)</li>
              </ul>
              <p style={{ color: "#aaa", fontStyle: "italic", fontSize: 14 }}>
                Our European version extends this: 15+ stops per city (vs. 7), explicitly themed around anti-fascism and American democracy, with a fully digital clue delivery system and embedded voter registration at every stop.
              </p>
            </Section>

            <Section title="Core Design Principles">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  ["🎮 Gamified, Not Preachy", "Points, badges, leaderboards, and competitive teams — the civic education is embedded, not front-loaded."],
                  ["📍 Place-Based", "Every stop exists in a physical city. Participants must go there. The walk is the experience."],
                  ["🗳️ Voter Registration First", "Every stop integrates one voter registration action. The hunt ends with actual registration."],
                  ["🏛️ Historically Grounded", "Each location is chosen for its genuine intersection of history, anti-fascism, and American democratic parallels."],
                  ["📱 Digitally Delivered", "Clues via app/web. QR codes at locations confirm presence. Social sharing built-in."],
                  ["🤝 Social by Design", "Teams of 2–5 encouraged. Shared submission for team challenges. Community leaderboard."],
                ].map(([title, desc]) => (
                  <div key={title} style={{
                    background: "#161616",
                    border: "1px solid #2a2a2a",
                    borderRadius: 8,
                    padding: 16,
                  }}>
                    <div style={{ fontWeight: 700, color: "#c4952a", marginBottom: 6, fontSize: 14 }}>{title}</div>
                    <div style={{ color: "#aaa", fontSize: 13, lineHeight: 1.6 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Target Audience">
              <p>American citizens living in or visiting European cities who are eligible to vote in US federal elections. Priority segments:</p>
              <ul style={{ paddingLeft: 20, lineHeight: 2, color: "#ccc" }}>
                <li><strong>Unregistered expats</strong> — the primary conversion target</li>
                <li><strong>Registered but disengaged expats</strong> — need to request ballots</li>
                <li><strong>Recent arrivals (students, professionals)</strong> — still connected to home states</li>
                <li><strong>Tourists with city layovers</strong> — a smaller but real segment</li>
              </ul>
            </Section>
          </div>
        )}

        {/* MECHANICS */}
        {activeTab === "mechanics" && (
          <div>
            <Section title="Hunt Format">
              <p>The hunt runs in two modes:</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
                <ModeCard
                  title="🏁 Live Event Mode"
                  desc="Coordinated start time. All teams begin simultaneously. Clues released in sequence every 15 minutes after first correct check-in at each stop. Real-time leaderboard. Prize for first finisher."
                />
                <ModeCard
                  title="🗺️ Self-Guided Mode"
                  desc="Available year-round. Participants complete stops in any order. No time pressure. Points accumulate. Badge collection emphasized. Registration CTA at every stop."
                />
              </div>
            </Section>

            <Section title="Scoring System">
              {[
                ["Check-in at location (QR scan)", "50 pts"],
                ["Challenge photo submitted", "Points vary (see locations)"],
                ["Voter registration action completed", "100 pts bonus"],
                ["Sharing on social media with #", "25 pts"],
                ["Completing all stops", "250 pts bonus"],
                ["Under 4 hours (live mode)", "100 pts speed bonus"],
                ["Team of 3+ members", "10% multiplier"],
              ].map(([action, pts]) => (
                <div key={action} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0", borderBottom: "1px solid #1a1a1a",
                }}>
                  <span style={{ color: "#ccc", fontSize: 14 }}>{action}</span>
                  <span style={{ color: "#c4952a", fontWeight: 700, fontSize: 13 }}>{pts}</span>
                </div>
              ))}
            </Section>

            <Section title="Team Mechanics">
              <ul style={{ paddingLeft: 20, lineHeight: 2, color: "#ccc", fontSize: 14 }}>
                <li>Teams of 2–5 form at registration</li>
                <li>One QR check-in per location per team</li>
                <li>Challenge photos submitted by any team member count for all</li>
                <li>One voter registration per participant (not shared) — each person must register individually</li>
                <li>Team leaderboard separate from individual leaderboard</li>
                <li>Teams encouraged to split and regroup — this is not a race within the team</li>
              </ul>
            </Section>

            <Section title="Prizes (Live Event)">
              {[
                ["🥇 1st Place Individual", "Democrats Abroad merchandise pack + VIP invitation to next DA event"],
                ["🥇 1st Place Team", "Group dinner at local restaurant (sponsored)"],
                ["🗳️ First Registrant", "Special 'First Voter' badge + featured in Democrats Abroad newsletter"],
                ["📸 Best Challenge Photo", "Voted by community — DA-branded prize pack"],
                ["🏅 All Finishers", "Limited-edition Freedom Hunt pin (not purchasable)"],
              ].map(([prize, desc]) => (
                <div key={prize} style={{ marginBottom: 12, display: "flex", gap: 12 }}>
                  <div style={{ fontWeight: 700, color: "#c4952a", minWidth: 200, fontSize: 13 }}>{prize}</div>
                  <div style={{ color: "#aaa", fontSize: 13 }}>{desc}</div>
                </div>
              ))}
            </Section>
          </div>
        )}

        {/* TECHNICAL */}
        {activeTab === "technical" && (
          <div>
            <Section title="Platform Architecture">
              <p>The app is a mobile-first Progressive Web App (PWA) — no app store download required. Participants access via link shared on social media / Democrats Abroad email list.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                {[
                  ["Frontend", "React PWA, installable on home screen. Offline-capable for clue viewing."],
                  ["Backend", "Supabase (PostgreSQL + Auth + Storage). Low-cost, real-time leaderboard via websockets."],
                  ["Location Verification", "QR codes at each physical location. Backup: GPS coordinates within 50m radius."],
                  ["Photo Submissions", "Direct upload to Supabase Storage. Moderated before appearing on community feed."],
                  ["Voter Registration", "Deep link integration with VoteFromAbroad.org API or iframe embed."],
                  ["Leaderboard", "Real-time via Supabase Realtime. Updates every 30 seconds on app."],
                ].map(([label, desc]) => (
                  <div key={label} style={{ background: "#111", border: "1px solid #222", borderRadius: 6, padding: 14 }}>
                    <div style={{ fontWeight: 700, color: "#c4952a", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
                    <div style={{ color: "#aaa", fontSize: 13, lineHeight: 1.6 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Core Screens">
              {[
                ["Onboarding / Registration", "Name, email, home state (for tailored voter reg info), team formation or solo play. Optional: link to VoteFromAbroad.org before starting."],
                ["Map View", "All locations shown on city map. Completed ones marked. Current active clue highlighted."],
                ["Clue Screen", "Full clue text, historical context expandable, challenge instructions, voting bridge CTA. Reveal-on-arrival mechanic in live mode."],
                ["Check-In Screen", "QR scanner (camera permission) + manual code entry fallback. Confirmation animation + points awarded."],
                ["Challenge Submission", "Camera access or gallery upload. Caption field. Submit to moderation queue."],
                ["Leaderboard", "Individual + Team tabs. Top 20 shown. Your rank always visible. Updates live."],
                ["Voter Registration Hub", "State-specific voting info. FWAB download. VoteFromAbroad.org embed. Confirmation of completed registration for bonus points."],
                ["Badge Collection", "All location badges + completion badge. Share individual badges to social media."],
                ["Final Stop Screen", "Celebration UI, full stats, share card generator, Democrats Abroad membership CTA."],
              ].map(([screen, desc]) => (
                <div key={screen} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #1a1a1a" }}>
                  <div style={{ fontWeight: 700, color: "#ddd", fontSize: 14, marginBottom: 4 }}>{screen}</div>
                  <div style={{ color: "#888", fontSize: 13, lineHeight: 1.6 }}>{desc}</div>
                </div>
              ))}
            </Section>

            <Section title="QR Code Logistics">
              <ul style={{ paddingLeft: 20, lineHeight: 2, color: "#ccc", fontSize: 14 }}>
                <li>Weatherproof QR stickers placed at each location before event day</li>
                <li>Each QR is location-specific and time-limited (expires 48hrs after event)</li>
                <li>Backup: organizer can "unlock" a stop manually via admin panel for accessibility</li>
                <li>Admin panel shows real-time check-in rates per location to identify bottlenecks</li>
                <li>QR placement must be pre-scouted — specific anchor points documented in organizer guide</li>
              </ul>
            </Section>

            <Section title="Accessibility">
              <ul style={{ paddingLeft: 20, lineHeight: 2, color: "#ccc", fontSize: 14 }}>
                <li>All locations wheelchair accessible (or have accessible alternative nearby)</li>
                <li>App supports screen readers (WCAG 2.1 AA)</li>
                <li>Clue text available in English and Spanish</li>
                <li>Audio clue option (text-to-speech)</li>
                <li>Team mode means one member can complete physical challenges for the group</li>
              </ul>
            </Section>
          </div>
        )}

        {/* VOTING INTEGRATION */}
        {activeTab === "content" && (
          <div>
            <Section title="The Voting Funnel">
              <p>Every location on the hunt is designed to move participants through a voter engagement funnel. The hunt is not a registration event with a fun wrapper — it's a genuinely engaging experience with registration woven into every moment.</p>
              <div style={{ marginTop: 20 }}>
                {[
                  ["AWARENESS", "#3a6186", "Participants learn that expat votes count in home states. Historical stops connect present-day democracy to historical stakes."],
                  ["MOTIVATION", "#804b00", "Each location bridges a historical anti-fascism story to a current American democratic stakes parallel."],
                  ["FRICTION REMOVAL", "#1a4a1a", "VoteFromAbroad.org embedded directly in app. Home-state info pre-loaded based on registration. FWAB downloadable in-app."],
                  ["ACTION", "#4a0a00", "Voter registration action at every stop (optional, bonus points). Mandatory action at final stop."],
                  ["SOCIAL PROOF", "#2a1a4a", "Community leaderboard shows registered participants. Share card shows your registration status (opt-in)."],
                  ["RETENTION", "#1a3a3a", "Post-hunt: ballot request reminder emails, election date alerts, next DA event invitation."],
                ].map(([stage, color, desc]) => (
                  <div key={stage} style={{ display: "flex", gap: 16, marginBottom: 12, alignItems: "flex-start" }}>
                    <div style={{
                      background: color,
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 1,
                      padding: "4px 10px",
                      borderRadius: 4,
                      minWidth: 100,
                      textAlign: "center",
                    }}>
                      {stage}
                    </div>
                    <div style={{ color: "#aaa", fontSize: 13, lineHeight: 1.6 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="State-Specific Voter Information">
              <p style={{ color: "#aaa", fontSize: 14 }}>At onboarding, participants select their home state. The app then surfaces:</p>
              <ul style={{ paddingLeft: 20, lineHeight: 2, color: "#ccc", fontSize: 14 }}>
                <li>Registration deadline (with countdown timer if upcoming)</li>
                <li>Absentee ballot request deadline</li>
                <li>Whether UOCAVA (Uniformed and Overseas Citizens Absentee Voting Act) applies</li>
                <li>Link to state-specific OVR (Online Voter Registration)</li>
                <li>Upcoming elections in their state (with dates)</li>
                <li>Whether their state has competitive races (motivation)</li>
              </ul>
            </Section>

            <Section title="Democrats Abroad Integration">
              <ul style={{ paddingLeft: 20, lineHeight: 2, color: "#ccc", fontSize: 14 }}>
                <li>Hunt is co-branded with Democrats Abroad local chapter</li>
                <li>DA membership CTA at final stop + post-hunt email</li>
                <li>Registered participants added to DA mailing list (opt-in)</li>
                <li>Hunt results shared with DA global for GOTV reporting</li>
                <li>Organizer toolkit and repeat-run guide created so other DA chapters can fork the model</li>
              </ul>
            </Section>

            <Section title="Post-Hunt Follow-Up Sequence">
              {[
                ["Day 0 (post-hunt)", "Congratulations email with badge wall + share card + VoteFromAbroad.org reminder"],
                ["Day 3", "Did you request your ballot? One-click ballot request link for their state"],
                ["Day 14", "Upcoming election alert (if applicable) + DA local event invitation"],
                ["Day 30", "Check-in: Have you sent your ballot? Help a friend register link"],
                ["Day 60", "Election reminder with local watch party info"],
              ].map(([day, desc]) => (
                <div key={day} style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                  <div style={{ color: "#c4952a", fontSize: 12, fontWeight: 700, minWidth: 120 }}>{day}</div>
                  <div style={{ color: "#aaa", fontSize: 13 }}>{desc}</div>
                </div>
              ))}
            </Section>

            <Section title="Success Metrics">
              {[
                ["Primary", "Number of new voter registrations completed during or immediately after hunt"],
                ["Secondary", "Number of absentee ballots requested within 14 days"],
                ["Engagement", "% of participants completing all stops"],
                ["Reach", "Social impressions from shared cards + hashtag tracking"],
                ["Community", "New Democrats Abroad members"],
                ["Replicability", "Number of other DA chapters that run the hunt within 6 months"],
              ].map(([type, metric]) => (
                <div key={type} style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                  <div style={{
                    background: "#1a1a1a", border: "1px solid #333", borderRadius: 4,
                    padding: "2px 10px", fontSize: 11, color: "#888", minWidth: 100, textAlign: "center",
                  }}>{type}</div>
                  <div style={{ color: "#ccc", fontSize: 13, lineHeight: 1.6 }}>{metric}</div>
                </div>
              ))}
            </Section>
          </div>
        )}

        {/* CITIES */}
        {activeTab === "cities" && (
          <div>
            <Section title="Cities">
              <p>Each city hunt is designed by the local Democrats Abroad chapter. Every hunt shares the same game mechanics and voter registration framework, but locations, historical themes, and American connections are unique to each city.</p>
            </Section>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
              {cities.map(city => (
                <div key={city.id} style={{
                  background: "#0e0e0e",
                  border: `1px solid ${city.status === "active" ? "#c4952a" : "#2a2a2a"}`,
                  borderRadius: 10,
                  overflow: "hidden",
                  opacity: city.status === "active" ? 1 : 0.7,
                }}>
                  <div style={{
                    background: city.status === "active"
                      ? "linear-gradient(135deg, #1a0a00 0%, #0d1a2e 100%)"
                      : "#111",
                    padding: "20px 20px 16px",
                    borderBottom: `1px solid ${city.status === "active" ? "#c4952a33" : "#1a1a1a"}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 36 }}>{city.flag}</span>
                      {city.status === "coming-soon" && (
                        <span style={{
                          background: "#1a1a1a",
                          border: "1px solid #333",
                          color: "#666",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: 1,
                          padding: "3px 8px",
                          borderRadius: 4,
                          textTransform: "uppercase",
                        }}>
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <h3 style={{
                      margin: "0 0 2px",
                      fontSize: 20,
                      fontWeight: 700,
                      color: "#e8e0d0",
                      fontFamily: "'Playfair Display', Georgia, serif",
                    }}>
                      {city.name}
                    </h3>
                    <div style={{ fontSize: 12, color: "#666", letterSpacing: 0.5 }}>{city.country}</div>
                  </div>

                  <div style={{ padding: 20 }}>
                    <p style={{
                      fontSize: 13,
                      color: "#888",
                      fontStyle: "italic",
                      margin: "0 0 10px",
                      lineHeight: 1.5,
                    }}>
                      {city.tagline}
                    </p>
                    <p style={{
                      fontSize: 13,
                      color: "#aaa",
                      margin: "0 0 16px",
                      lineHeight: 1.6,
                    }}>
                      {city.description}
                    </p>

                    {city.status === "active" ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: "#666" }}>
                          {city.locationCount} locations
                        </span>
                        <Link
                          to={`/${city.id}`}
                          style={{
                            background: "#c4952a",
                            color: "#0a0a0a",
                            padding: "8px 16px",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 700,
                            textDecoration: "none",
                            fontFamily: "'Lora', Georgia, serif",
                            display: "inline-block",
                          }}
                        >
                          Explore →
                        </Link>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>
                        Locations being planned by local DA chapter
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
          <p>The Freedom Hunt — Product Specification v1.0</p>
          <p>Democrats Abroad × Inspired by Mamdani for NYC 2025</p>
          <p style={{ color: "#c4952a", marginTop: 8 }}>VoteFromAbroad.org | democratsabroad.org</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{
        fontSize: 18,
        fontWeight: 700,
        color: "#c4952a",
        borderBottom: "1px solid #2a2a2a",
        paddingBottom: 10,
        marginBottom: 16,
        letterSpacing: "-0.3px",
        fontFamily: "'Playfair Display', Georgia, serif",
      }}>{title}</h2>
      <div style={{ fontSize: 14, lineHeight: 1.75, color: "#bbb" }}>{children}</div>
    </div>
  );
}

function ModeCard({ title, desc }) {
  return (
    <div style={{
      background: "#111",
      border: "1px solid #2a2a2a",
      borderRadius: 8,
      padding: 16,
    }}>
      <div style={{ fontWeight: 700, color: "#e8e0d0", marginBottom: 8 }}>{title}</div>
      <div style={{ color: "#888", fontSize: 13, lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}
