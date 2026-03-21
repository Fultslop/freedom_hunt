import { useState } from "react";

const LOCATIONS = [
  {
    id: 1,
    name: "Anne Frank House",
    neighborhood: "Jordaan",
    coords: "52.3752° N, 4.8840° E",
    theme: "Silence & Complicity",
    clue: "Where a teenager's diary outlasted a regime — what does it mean when a democracy does nothing? Find the canal house where silence was survival, and ask yourself: whose silence helps fascism today?",
    historicalHook: "Anne Frank's family went into hiding in 1942. The Nazi occupation of the Netherlands was enabled by bureaucratic complicity — the same kind that voter suppression relies on.",
    americanConnection: "The US delayed entering WWII in part due to domestic isolationism and antisemitism. American voters ultimately changed that calculus. Your vote from abroad carries the same weight.",
    challenge: "Find the 'Secret Annexe' plaque. Take a photo with it and share one thing you learned about the Dutch resistance.",
    votingBridge: "Register to vote using the FWAB (Federal Write-In Absentee Ballot) — it works even when your state misses your registration.",
    points: 200,
    badge: "🕯️ The Witness",
  },
  {
    id: 2,
    name: "Homomonument",
    neighborhood: "Westermarkt",
    coords: "52.3742° N, 4.8836° E",
    theme: "Visibility as Resistance",
    clue: "Three pink triangles form a monument to those persecuted by Nazis for who they loved. It stands near Anne Frank's house on purpose. Find it and read the inscriptions.",
    historicalHook: "The Nazi regime systematically persecuted LGBTQ+ people. The Homomonument, built in 1987, reclaims the pink triangle — a badge of persecution — as a symbol of pride.",
    americanConnection: "American LGBTQ+ rights have advanced through elections. The current administration is actively rolling them back. Expat voters in swing states have decided these issues.",
    challenge: "Find all three triangle points. Each represents a different time: past, present, future. Photograph the one that speaks to you most.",
    votingBridge: "Your vote helps determine federal protections for LGBTQ+ Americans. Democrats Abroad can help you register in minutes.",
    points: 150,
    badge: "🔺 The Triangle",
  },
  {
    id: 3,
    name: "Waterlooplein — Former Jewish Quarter",
    neighborhood: "Centrum",
    coords: "52.3680° N, 4.9008° E",
    theme: "Erasure & Memory",
    clue: "Once the beating heart of Amsterdam's Jewish community, this square saw 80,000 deportations. Today it hosts a flea market. Find the Dokwerker statue nearby and read why a dockworker became a symbol of solidarity.",
    historicalHook: "The February Strike of 1941 — Amsterdam workers went on strike to protest the deportation of Jews. It was the only mass non-Jewish protest against Nazi antisemitism in occupied Europe.",
    americanConnection: "The strike was crushed, but it happened. It showed that ordinary people can choose to act. Voting is the version of that choice available to you right now.",
    challenge: "Find the Dokwerker statue. Read the inscription. Write down one thing the dockworkers risked — and one thing voting from abroad costs you.",
    votingBridge: "The February Strike took courage. Registering to vote takes 3 minutes at VoteFromAbroad.org",
    points: 175,
    badge: "✊ The Dockworker",
  },
  {
    id: 4,
    name: "Verzetsmuseum (Dutch Resistance Museum)",
    neighborhood: "Plantage",
    coords: "52.3647° N, 4.9155° E",
    theme: "Forms of Resistance",
    clue: "Inside this museum are stories of people who printed underground newspapers, forged documents, and hid Jewish families. Outside, find the plaque about the children of the resistance. What did they do?",
    historicalHook: "The Dutch resistance operated in cells to avoid infiltration. They made individual choices, often alone, that together formed a movement. Sound familiar?",
    americanConnection: "American democracy has always required maintenance by people who showed up — suffragists, civil rights workers, and yes, overseas voters whose ballots decided Senate races.",
    challenge: "Find the museum's 'three responses' exhibit (adapt, collaborate, resist). Which response describes American politics today? Photograph your answer.",
    votingBridge: "Resistance took many forms. Yours is a ballot. Request it today — processing takes up to 4 weeks.",
    points: 200,
    badge: "📰 The Resister",
  },
  {
    id: 5,
    name: "Artis Royal Zoo — Aquarium Building",
    neighborhood: "Plantage",
    coords: "52.3660° N, 4.9163° E",
    theme: "Hidden in Plain Sight",
    clue: "During the war, a Dutch banker hid 80,000 Jewish financial records inside the Artis aquarium to prevent Nazi confiscation. Find the historical marker and look for what's hidden in plain sight today.",
    historicalHook: "Wim Goudriaan hid records from AMRO Bank in the aquarium's basement from 1943–1945. Small acts of preservation kept entire communities' identities intact.",
    americanConnection: "Voter rolls and registration records are under political attack in the US. Your overseas registration preserves your political identity.",
    challenge: "Find the aquarium building facade. What animals are carved into it? They were chosen to represent different continents — find America.",
    votingBridge: "Protecting voter registration is as important as casting a ballot. Help a friend register today — share VoteFromAbroad.org",
    points: 125,
    badge: "🐟 The Keeper",
  },
  {
    id: 6,
    name: "Tropenmuseum",
    neighborhood: "Oost",
    coords: "52.3581° N, 4.9160° E",
    theme: "Empire & Democracy",
    clue: "This former colonial museum now tells the story of Dutch imperialism honestly. American democracy was built on similar contradictions. Find the exhibition on Indonesia and ask: when does a democracy stop being one?",
    historicalHook: "The Netherlands colonized Indonesia for 350 years. WWII occupation forced the Dutch to reckon with what it felt like to be colonized. Independence movements followed.",
    americanConnection: "American democracy excluded Black, Indigenous, and female voters for most of its history. The Voting Rights Act of 1965 was not a given — it was fought for. It is being dismantled now.",
    challenge: "Find the globe at the museum entrance. How many continents were colonized by European powers that are now democracies? Photograph your count.",
    votingBridge: "The franchise was earned through struggle. Honor that by using it. Register at VoteFromAbroad.org",
    points: 150,
    badge: "🌍 The Reckoner",
  },
  {
    id: 7,
    name: "Oosterpark — Theo van Gogh Memorial",
    neighborhood: "Oost",
    coords: "52.3592° N, 4.9218° E",
    theme: "Free Expression Under Threat",
    clue: "Near this park is a memorial to Theo van Gogh, murdered for his film criticism of religious extremism. The memorial is a scream frozen in bronze. What does free expression require of a democracy?",
    historicalHook: "Van Gogh's 2004 murder ignited debates about free speech, integration, and democratic values in Europe. Democracies must protect dissent — even unpopular dissent.",
    americanConnection: "The First Amendment is only as strong as the institutions that enforce it. Courts, elected officials, and an active citizenry all play a role.",
    challenge: "Find 'De Schreeuw' (The Scream) sculpture nearby. What is the figure doing — screaming in fear or in defiance? Photograph your interpretation.",
    votingBridge: "Democratic freedoms require democratic participation. Your vote is part of what protects free expression.",
    points: 125,
    badge: "📢 The Voice",
  },
  {
    id: 8,
    name: "Hollandsche Schouwburg",
    neighborhood: "Plantage",
    coords: "52.3656° N, 4.9136° E",
    theme: "The Machinery of Persecution",
    clue: "This theater was turned into a deportation holding center. 46,000 Jews passed through on their way to the camps. A crèche across the street became a secret rescue operation. Find the eternal flame.",
    historicalHook: "The crèche across the street (Henriette Henriques Hermans Crèche) secretly smuggled children to safety with the help of students from the Amsterdam University. 600 children escaped.",
    americanConnection: "American students organized the civil rights sit-ins. Youth voter turnout determined recent elections. The Mamdani scavenger hunt drew thousands of young organizers. You are that generation.",
    challenge: "Find the memorial wall with names. Pick one name at random and look it up. Write what you find in our shared register.",
    votingBridge: "Those 46,000 had no vote. You have one. Use it by requesting your absentee ballot today.",
    points: 250,
    badge: "🕍 The Witness II",
  },
  {
    id: 9,
    name: "Nieuwmarkt Square — Former Nazi Checkpoint",
    neighborhood: "Centrum",
    coords: "52.3726° N, 4.9005° E",
    theme: "Papers, Please",
    clue: "During the occupation, the Nazis used this square for razzia — mass round-ups where people were demanded to show papers. Amsterdam's residents organized resistance networks in response. Find the De Waag building at the center.",
    historicalHook: "The Dutch were among Europe's most administratively organized nations — which made them, tragically, easier to surveil and oppress. Bureaucracy is not neutral.",
    americanConnection: "Voter ID laws, registration purges, and gerrymandering are the modern forms of paper-checking. They are designed with precision to reduce specific kinds of votes.",
    challenge: "De Waag has been a weighing house, guildhall, hospital, and nightclub. Find one element from each era on its facade. Democracy also wears many faces.",
    votingBridge: "Know your voting rights. Democrats Abroad's legal team fights voter suppression. Join them and vote.",
    points: 175,
    badge: "📋 The Paperwork",
  },
  {
    id: 10,
    name: "Dam Square — National Monument",
    neighborhood: "Centrum",
    coords: "52.3731° N, 4.8932° E",
    theme: "Liberation & Its Cost",
    clue: "The 22-meter obelisk contains urns of soil from every Dutch province and every WWII concentration camp. It was unveiled in 1956 by Queen Juliana. What does a country owe the dead?",
    historicalHook: "The Netherlands was liberated in May 1945 — five years of occupation. The national memorial was placed at the geographic and symbolic heart of Amsterdam. Liberation Day is still celebrated on May 5.",
    americanConnection: "American soldiers were among those who liberated the Netherlands. The Marshall Plan helped rebuild Europe. American foreign policy shaped by voters protects or undermines these gains.",
    challenge: "Find the reliefs on the sides of the monument. One shows a woman in chains (war), one shows a man with a dog (peace). Photograph both.",
    votingBridge: "American foreign policy is shaped by elections. Vote to decide whether the US continues to support its democratic allies.",
    points: 200,
    badge: "🗽 The Liberator",
  },
  {
    id: 11,
    name: "Begijnhof — Hidden Church",
    neighborhood: "Centrum",
    coords: "52.3694° N, 4.8900° E",
    theme: "Faith, Persecution & Sanctuary",
    clue: "Inside this hidden medieval courtyard is the oldest wooden house in Amsterdam and a secret Catholic church hidden from Protestant authorities. Find the entrance off Spui Square.",
    historicalHook: "During the 16th–17th century, Catholics were forbidden from public worship in Amsterdam. They built clandestine 'hidden churches' (schuilkerken) that look like ordinary canal houses.",
    americanConnection: "Religious freedom was written into the First Amendment precisely because the founders knew what state-imposed religion looked like. That protection is now contested.",
    challenge: "The courtyard has English Reformed Church (1607) and the hidden Catholic church side by side. Photograph them together — coexistence made physical.",
    votingBridge: "The wall between church and state requires constant maintenance. Vote to decide who maintains it.",
    points: 150,
    badge: "⛪ The Sanctuary",
  },
  {
    id: 12,
    name: "Westerkerk Tower",
    neighborhood: "Jordaan",
    coords: "52.3746° N, 4.8836° E",
    theme: "The View from Above",
    clue: "Rembrandt is buried somewhere in this church (exact location unknown). Anne Frank could hear its bells from the Secret Annexe and wrote about them in her diary. Climb the tower. What can you see?",
    historicalHook: "The Westerkerk tower offers a panoramic view of the city. It was completed in 1638 — the height of the Dutch Golden Age, built on global trade, tolerance, and slavery.",
    americanConnection: "America's founding ideals were also built on contradictions — freedom and slavery, equality and exclusion. Working out those contradictions is what American elections are about.",
    challenge: "From the top of the tower, find the Anne Frank House. Find the Homomonument. Find the Hollandsche Schouwburg direction. Connect the dots: what story does Amsterdam's geography tell?",
    votingBridge: "Perspective matters. From here you can see how close liberation and persecution always were. Register today from wherever you stand.",
    points: 175,
    badge: "🔭 The Lookout",
  },
  {
    id: 13,
    name: "Spinhuis — Former Women's Workhouse",
    neighborhood: "Centrum",
    coords: "52.3706° N, 4.8980° E",
    theme: "Women, Power & the Vote",
    clue: "This 17th century building imprisoned women deemed 'disorderly' — including those who defied social norms. It's now apartments. Find the 1645 facade relief showing a woman whipping women — and ask what has changed.",
    historicalHook: "Dutch women gained the right to vote in 1919, one year before American women. The suffrage movement operated across borders, sharing tactics and solidarity.",
    americanConnection: "The 19th Amendment (1920) was a milestone, not a destination. Women's reproductive autonomy, equal pay, and political representation remain contested. Abortion access is on ballots.",
    challenge: "Find the inscription above the gate: 'Schrik niet, ik wreek geen kwaad maar dwing tot goed' (Fear not, I take no revenge but force toward good). What does this mean to you now?",
    votingBridge: "Women's suffrage wasn't given — it was organized, marched, and voted for. Your turn.",
    points: 150,
    badge: "⚡ The Suffragist",
  },
  {
    id: 14,
    name: "NEMO Science Museum Rooftop",
    neighborhood: "Oosterdok",
    coords: "52.3741° N, 4.9122° E",
    theme: "Science, Truth & Democracy",
    clue: "Climb to the free public rooftop of the NEMO museum — its hull shape represents the prow of a ship cutting through the IJ. From here, the entire historic centre is visible. What does it take to navigate democracy?",
    historicalHook: "Amsterdam was the publishing capital of 17th century Europe precisely because it tolerated ideas censored elsewhere. Galileo, Descartes, and Spinoza published here. Scientific freedom and political freedom travel together.",
    americanConnection: "Science denial — about climate, vaccines, elections — is a democracy problem, not just a science problem. Evidence-based policy requires voters who demand it.",
    challenge: "Find the view of the harbor. Amsterdam's wealth and liberalism came from global trade. The US also has a 'harbor view' — Ellis Island. Photograph the horizon and caption it.",
    votingBridge: "Climate policy, public health, and research funding are all decided by elections. Vote for science.",
    points: 125,
    badge: "🔬 The Scientist",
  },
  {
    id: 15,
    name: "Americans Abroad Registration Hub — Café de Jaren",
    neighborhood: "Centrum",
    coords: "52.3691° N, 4.8976° E",
    theme: "FINISH LINE — Register & Celebrate",
    clue: "You made it. This grand café on the Amstel has been a meeting place for Amsterdam's literary and political class for decades. Find the Democrats Abroad table, register to vote if you haven't, and collect your final stamp.",
    historicalHook: "Every historical location on this hunt existed because people made choices — to resist, to vote, to hide others, to speak out. Today's choice is simpler: 5 minutes at VoteFromAbroad.org",
    americanConnection: "Americans abroad vote in their home state — meaning your vote counts in competitive House, Senate, and presidential races. Expats in Europe turned Pennsylvania in 2020.",
    challenge: "Register to vote (or verify your registration). Share a photo from your hunt using #AmsterdamForDemocracy. Get your chai and your Democrats Abroad pin.",
    votingBridge: "THIS IS IT. Register now: VoteFromAbroad.org | democratsabroad.org",
    points: 500,
    badge: "🗳️ THE VOTER",
    isFinal: true,
  },
];

const TOTAL_POINTS = LOCATIONS.reduce((s, l) => s + l.points, 0);

const themeColors = {
  "Silence & Complicity": "#8B1A1A",
  "Visibility as Resistance": "#C2185B",
  "Erasure & Memory": "#4A148C",
  "Forms of Resistance": "#1A237E",
  "Hidden in Plain Sight": "#004D40",
  "Empire & Democracy": "#E65100",
  "Free Expression Under Threat": "#827717",
  "The Machinery of Persecution": "#37474F",
  "Papers, Please": "#3E2723",
  "Liberation & Its Cost": "#1B5E20",
  "Faith, Persecution & Sanctuary": "#880E4F",
  "The View from Above": "#0D47A1",
  "Women, Power & the Vote": "#6A1B9A",
  "Science, Truth & Democracy": "#006064",
  "FINISH LINE — Register & Celebrate": "#BF360C",
};

export default function HuntSpec() {
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedLocation, setExpandedLocation] = useState(null);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "locations", label: "15 Locations" },
    { id: "mechanics", label: "Game Mechanics" },
    { id: "technical", label: "Technical Spec" },
    { id: "content", label: "Voting Integration" },
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
            <span style={{ fontSize: 32 }}>🇳🇱</span>
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
            The Amsterdam Freedom Hunt
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
            Inspired by Zohran Mamdani's NYC scavenger hunt — 15 historical locations across Amsterdam connecting the fight against fascism, American democratic history, and your power to vote from abroad.
          </p>
          <div style={{
            display: "flex", gap: 24, marginTop: 24, flexWrap: "wrap",
          }}>
            {[
              ["15", "Historical Stops"],
              [TOTAL_POINTS.toLocaleString(), "Total Points"],
              ["~4hrs", "Walk Time"],
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
              <p>The Amsterdam Freedom Hunt is a gamified, digitally-run scavenger hunt across Amsterdam for American expats. It is run by Democrats Abroad Netherlands and designed to drive voter registration while building community, political consciousness, and genuine fun.</p>
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
                Our Amsterdam version extends this: 15 stops (vs. 7), explicitly themed around anti-fascism and American democracy, with a fully digital clue delivery system and embedded voter registration at every stop.
              </p>
            </Section>

            <Section title="Core Design Principles">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  ["🎮 Gamified, Not Preachy", "Points, badges, leaderboards, and competitive teams — the civic education is embedded, not front-loaded."],
                  ["📍 Place-Based", "Every stop exists in physical Amsterdam. Participants must go there. The walk is the experience."],
                  ["🗳️ Voter Registration First", "Every stop integrates one voter registration action. The hunt ends with actual registration."],
                  ["🏛️ Historically Grounded", "Each location is chosen for its genuine intersection of WWII history, anti-fascism, and American democratic parallels."],
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
              <p>American citizens living in or visiting Amsterdam who are eligible to vote in US federal elections. Priority segments:</p>
              <ul style={{ paddingLeft: 20, lineHeight: 2, color: "#ccc" }}>
                <li><strong>Unregistered expats</strong> — the primary conversion target</li>
                <li><strong>Registered but disengaged expats</strong> — need to request ballots</li>
                <li><strong>Recent arrivals (students, professionals)</strong> — still connected to home states</li>
                <li><strong>Tourists with Amsterdam layovers</strong> — a smaller but real segment</li>
              </ul>
            </Section>
          </div>
        )}

        {/* LOCATIONS */}
        {activeTab === "locations" && (
          <div>
            <p style={{ color: "#888", fontStyle: "italic", marginBottom: 24 }}>
              15 stops designed as a roughly 4-hour walk through central Amsterdam, all accessible by public transit. Click any stop to expand its full brief.
            </p>

            {/* Route summary */}
            <div style={{
              background: "#111",
              border: "1px solid #c4952a",
              borderRadius: 8,
              padding: 16,
              marginBottom: 28,
              fontSize: 13,
              color: "#aaa",
            }}>
              <strong style={{ color: "#c4952a" }}>Suggested Route:</strong> Jordaan → Plantage → Oost → Centrum → Jordaan → Centrum → Oosterdok → Centrum
              <span style={{ marginLeft: 16, color: "#666" }}>~6.5km total walk</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {LOCATIONS.map((loc) => (
                <div key={loc.id}
                  style={{
                    background: expandedLocation === loc.id ? "#131313" : "#0e0e0e",
                    border: `1px solid ${expandedLocation === loc.id ? "#c4952a" : "#222"}`,
                    borderRadius: 8,
                    overflow: "hidden",
                    transition: "border-color 0.2s",
                  }}>
                  <button
                    onClick={() => setExpandedLocation(expandedLocation === loc.id ? null : loc.id)}
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
                      <div style={{ fontSize: 12, color: themeColors[loc.theme] || "#888", marginTop: 2 }}>
                        {loc.theme}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <div style={{ fontSize: 20 }}>{loc.badge.split(" ")[0]}</div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#c4952a" }}>{loc.points}</div>
                        <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase" }}>pts</div>
                      </div>
                      <span style={{ color: "#444", fontSize: 18 }}>{expandedLocation === loc.id ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {expandedLocation === loc.id && (
                    <div style={{ padding: "0 20px 20px", borderTop: "1px solid #1e1e1e" }}>
                      <div style={{ marginTop: 16 }}>
                        <Label>📍 Location</Label>
                        <p style={{ color: "#aaa", fontSize: 13 }}>{loc.coords} — {loc.neighborhood}</p>
                      </div>
                      <div>
                        <Label>🧩 The Clue</Label>
                        <p style={{ color: "#ddd", fontStyle: "italic", fontSize: 14, lineHeight: 1.7, borderLeft: `3px solid ${themeColors[loc.theme] || "#555"}`, paddingLeft: 12 }}>
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
              ))}
            </div>
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
                ["Completing all 15 stops", "250 pts bonus"],
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

            <Section title="Badge System">
              <p style={{ color: "#888", fontSize: 13 }}>Each location unlocks one badge. Badges are displayed on the user's profile and can be shared. A complete badge wall = special "Full Hunt" badge unlockable.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                {LOCATIONS.map(loc => (
                  <div key={loc.id} style={{
                    background: "#161616",
                    border: "1px solid #2a2a2a",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ fontSize: 20 }}>{loc.badge.split(" ")[0]}</span>
                    <span style={{ color: "#aaa" }}>{loc.badge.replace(loc.badge.split(" ")[0] + " ", "")}</span>
                  </div>
                ))}
              </div>
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
                ["🥇 1st Place Team", "Group dinner at Amsterdam restaurant (sponsored)"],
                ["🗳️ First Registrant", "Special 'First Voter' badge + featured in Democrats Abroad newsletter"],
                ["📸 Best Challenge Photo", "Voted by community — DA-branded prize pack"],
                ["🏅 All Finishers", "Limited-edition 'Amsterdam Freedom Hunt' pin (not purchasable)"],
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
                ["Map View", "All 15 locations shown on Amsterdam map. Completed ones marked. Current active clue highlighted."],
                ["Clue Screen", "Full clue text, historical context expandable, challenge instructions, voting bridge CTA. Reveal-on-arrival mechanic in live mode."],
                ["Check-In Screen", "QR scanner (camera permission) + manual code entry fallback. Confirmation animation + points awarded."],
                ["Challenge Submission", "Camera access or gallery upload. Caption field. Submit to moderation queue."],
                ["Leaderboard", "Individual + Team tabs. Top 20 shown. Your rank always visible. Updates live."],
                ["Voter Registration Hub", "State-specific voting info. FWAB download. VoteFromAbroad.org embed. Confirmation of completed registration for bonus points."],
                ["Badge Collection", "All 16 badges (15 locations + completion). Share individual badges to social media."],
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

            <Section title="Social Sharing">
              <p style={{ color: "#aaa", fontSize: 14 }}>Each location generates a shareable card with:</p>
              <ul style={{ paddingLeft: 20, lineHeight: 2, color: "#ccc", fontSize: 13 }}>
                <li>Location name + badge earned</li>
                <li>One historical fact from that stop</li>
                <li>VoteFromAbroad.org QR code</li>
                <li>#AmsterdamForDemocracy #VoteFromAbroad hashtags</li>
                <li>Democrats Abroad logo</li>
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
                  ["ACTION", "#4a0a00", "Voter registration action at every stop (optional, bonus points). Mandatory action at final stop (Stop 15)."],
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
                <li>Hunt is co-branded with Democrats Abroad Netherlands chapter</li>
                <li>DA membership CTA at final stop + post-hunt email</li>
                <li>Registered participants added to DA Netherlands mailing list (opt-in)</li>
                <li>Hunt results shared with DA global for GOTV reporting</li>
                <li>Organizer toolkit and repeat-run guide created so other DA chapters can fork the model</li>
              </ul>
            </Section>

            <Section title="Post-Hunt Follow-Up Sequence">
              {[
                ["Day 0 (post-hunt)", "Congratulations email with badge wall + share card + VoteFromAbroad.org reminder"],
                ["Day 3", "Did you request your ballot? One-click ballot request link for their state"],
                ["Day 14", "Upcoming election alert (if applicable) + DA Netherlands event invitation"],
                ["Day 30", "Check-in: Have you sent your ballot? Help a friend register link"],
                ["Day 60", "Election reminder with local Amsterdam watch party info"],
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
                ["Engagement", "% of participants completing all 15 stops"],
                ["Reach", "Social impressions from shared cards + hashtag tracking"],
                ["Community", "New Democrats Abroad Netherlands members"],
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

        {/* Footer */}
        <div style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: "1px solid #1a1a1a",
          textAlign: "center",
          color: "#444",
          fontSize: 12,
        }}>
          <p>The Amsterdam Freedom Hunt — Product Specification v1.0</p>
          <p>Democrats Abroad Netherlands × Inspired by Mamdani for NYC 2025</p>
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
