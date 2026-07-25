# Oslo Dataset — Design Spec

**Date:** 2026-05-09
**Author:** Claude
**Status:** Approved

## Summary

Add Oslo as a second city under the `democrats_abroad` project. Oslo is a demo/showcase city — it does not carry the voter-registration call-to-action of Den Haag. The thematic arc is **"Democracy Under Siege"**: constitutional democracy → cultural freedom → occupation → resistance → international reckoning → peace. Seven locations, three routes.

---

## City Entry

**City ID:** `oslo`
**Project:** `democrats_abroad`

Add to `cities.yaml`:
```yaml
- id: oslo
  name: "Oslo"
  image: oslo-hero.jpg
  country: "Norway"
  description: "Where democracy was tested, resistance was born, and peace is celebrated every December."
```

**`oslo/oslo.yaml`:**
```yaml
city.title: "Oslo"
city.country: "Norway"
city.tagline: "Democracy tested, resistance born, peace celebrated"
city.description: |
  YES.WE.VOTE Oslo is a civic route through the Norwegian capital's living argument about what democracy
  costs — and what it is worth.

  In April 1940, Norway was occupied. Its king refused to surrender. Its parliament went into exile.
  Its people organised. Five years later, they came home.

  This route walks the sites of that story: from the constitution that inspired a nation, through the
  fortress where resisters were shot and collaborators were tried, to the hall where the world gathers
  every December to say that peace is still worth fighting for.

  Oslo is a demonstration city — a showcase of the YES.WE.VOTE format.
```

---

## Locations (7)

### 001 — Royal Palace (Det Kongelige Slott)

**File:** `001_loc_royal_palace.yaml`
**Address:** Slottsplassen 1, 0010 Oslo
**Coordinates:** lat 59.9169, lon 10.7274

**Title:** The King Who Said No

**Storyline:**
> In April 1940, German forces demanded King Haakon VII legitimise the Nazi occupation by appointing Vidkun Quisling as prime minister. He refused — a refusal that forced Germany to occupy Norway by military force rather than by consent, and that gave the Norwegian resistance its moral anchor for five years of occupation.

**Breadcrumb:**
> In the plaza in front of the palace, find the equestrian statue of King Karl Johan. Look at the pedestal. What year is inscribed, and who is the figure facing?

**Challenge:**
> The palace guard changes daily. Observe the ceremony or the posted guard. What uniform details distinguish the guard from a standard soldier? Note two visible differences. Then discuss: what does a head of state who refuses a collaborationist deal mean for a democracy?

**Form fields:**
- `photo` — Take a photo of the statue or the palace gate
- `string` — What year is on the Karl Johan pedestal?
- `radio` — How many guards are currently visible at the main gate? → `0` / `1` / `2` / `More than 2`
- `boolean` — Is the royal standard (flag) flying above the palace today?

**Image source:** Search Unsplash for "Oslo Royal Palace" — the front plaza shot by Mikita Yo ([@mikitayo](https://unsplash.com/@mikitayo)) or similar. Alternatively, Wikimedia Commons: `File:Oslo_Royal_Palace_2013.jpg` (CC BY-SA 3.0).

---

### 002 — Stortinget (Norwegian Parliament)

**File:** `002_loc_stortinget.yaml`
**Address:** Karl Johans gate 22, 0026 Oslo
**Coordinates:** lat 59.9131, lon 10.7387

**Title:** We, the People — 1814

**Storyline:**
> Norway's constitution, signed at Eidsvoll on 17 May 1814, was among the most liberal in the world at the time. It established sovereignty in the people, not the crown. The Stortinget — the Grand Assembly — has carried that mandate ever since: through independence from Sweden in 1905, through occupation and exile from 1940 to 1945, and back.

**Breadcrumb:**
> On the façade facing Karl Johans gate, find the two relief panels flanking the main entrance. Each depicts a scene from Norwegian civic or political life. Stand in front of one and describe what you see.

**Challenge:**
> Two relief panels flank the entrance — one on each side. Describe what each scene depicts. Then: which scene do you think belongs on the entrance to a parliament, and why? Discuss in your group.

**Form fields:**
- `photo` — Take a photo of one of the relief panels
- `string` — Describe the left relief panel scene
- `string` — Describe the right relief panel scene
- `radio` — Which panel does your group think better represents what a parliament is for? → `Left panel` / `Right panel` / `Neither` / `Both equally`
- `boolean` — Is the Norwegian flag flying above the building today?

**Image source:** Unsplash search "Stortinget Oslo". Wikimedia Commons: `File:Stortinget_utenifra.jpg` (public domain / CC).

---

### 003 — National Theatre (Nationaltheatret)

**File:** `003_loc_national_theatre.yaml`
**Address:** Johanne Dybwads plass 1, 0161 Oslo
**Coordinates:** lat 59.9126, lon 10.7326

**Title:** What We Dare to Say Aloud

**Storyline:**
> Henrik Ibsen's plays were political acts in domestic clothing. A Doll's House (1879) argued that women are full human beings. An Enemy of the People (1882) argued that a single honest person can be right when the crowd is wrong. Peer Gynt asked what it means to be yourself. The National Theatre, opened in 1899, was built for exactly this kind of truth-telling: art that names what power would prefer to leave unspoken.

**Breadcrumb:**
> Two bronze statues stand in front of the theatre. Name both men. One wrote A Doll's House. The other wrote Peer Gynt — a different play, a different man.

**Challenge:**
> Read the inscription on one of the two statue pedestals. Which of Ibsen's recurring themes feels most alive in the world right now — individual freedom against social pressure, institutional corruption, or the tyranny of the majority opinion? Discuss with your group and agree on one answer.

**Form fields:**
- `photo` — Take a photo of one of the statues
- `boolean` — Did you find both statues?
- `string` — Copy the inscription from one of the pedestals
- `radio` — Which Ibsen theme did your group choose? → `Individual freedom against social pressure` / `Institutional corruption` / `Tyranny of majority opinion` / `We couldn't agree`

**Image source:** Unsplash search "Nationaltheatret Oslo". Wikimedia Commons: `File:Nationaltheatret_Oslo.jpg` (CC BY-SA).

---

### 004 — Akershus Fortress (Akershus Festning)

**File:** `004_loc_akershus.yaml`
**Address:** Akershus festning, 0150 Oslo
**Coordinates:** lat 59.9083, lon 10.7368

**Title:** The Fortress That Fell, Then Remembered

**Storyline:**
> Akershus Fortress fell to German forces on 9 April 1940 without a battle — caught in the chaos of the invasion. Over the following five years it became a Gestapo prison, a place of torture, and an execution ground. Norwegian resistance fighters were shot in its courtyard. In 1945, it was here that Vidkun Quisling — the man whose name became a synonym for traitor — was tried by a Norwegian court and executed.

**Breadcrumb:**
> Inside the fortress grounds, find the memorial to the Norwegians who were executed here during the occupation. Look for a plaque or stone marker near the execution site.

**Challenge:**
> Stand in the fortress courtyard. Without checking your phone: how many Norwegian resistance fighters do you think were executed at Akershus during the five years of occupation? Write your estimate. Then look it up — how close were you?

**Form fields:**
- `photo` — Take a photo of the memorial or the courtyard
- `boolean` — Did you find the execution site memorial?
- `number` — Your estimate (before looking it up): how many were executed here?
- `string` — Describe what you can see from where you're standing
- `radio` — How did the space make you feel? → `Solemn` / `Angry` / `Proud` / `Numb`

**Image source:** Unsplash search "Akershus Fortress Oslo". Wikimedia Commons: `File:Akershus_Fortress_Oslo_2013.jpg` (CC BY-SA).

---

### 005 — Norwegian Resistance Museum (Norges Hjemmefrontmuseum)

**File:** `005_loc_resistance_museum.yaml`
**Address:** Akershus festning (Bankplassen side), 0150 Oslo
**Coordinates:** lat 59.9089, lon 10.7352

**Title:** Ordinary People, Impossible Choices

**Storyline:**
> The Norges Hjemmefrontmuseum sits on the Akershus grounds, in the building that was used by German authorities during the occupation. It documents the full spectrum of Norwegian responses to occupation: collaboration, silence, and resistance. The resistance — Milorg — organised more than 40,000 people by the end of the war. Most of them were ordinary people who decided that some things were worth risking their lives for.

**Breadcrumb:**
> At the museum entrance, look for the date that marks Norway's liberation. What is it?

**Challenge:**
> Walk through the museum and find one object, document, or story that you think every democracy should know about. Note what it is and why you chose it — in your own words, not the museum's.

**Form fields:**
- `photo` — Take a photo of the object or display you chose
- `boolean` — Did you enter the museum?
- `string` — What liberation date did you find at the entrance?
- `string` — What did you find inside, and why does it matter?
- `radio` — What surprised you most? → `The scale of organised resistance` / `The extent of collaboration` / `Individual acts of courage` / `The role of women in the resistance`

**Image source:** Wikimedia Commons: `File:Norwegian_Resistance_Museum_entrance.jpg` or search for "Hjemmefrontmuseum Oslo". The museum exterior is frequently photographed under CC licenses.

---

### 006 — Nobel Peace Center (Nobels Fredssenter)

**File:** `006_loc_nobel_center.yaml`
**Address:** Bryggetorget 3, 0250 Oslo
**Coordinates:** lat 59.9088, lon 10.7264

**Title:** The Prize the World Gives Itself

**Storyline:**
> Alfred Nobel left most of his fortune to establish prizes for human achievement — and assigned the peace prize specifically to Norway, then not yet independent from Sweden. Since 1901 it has been awarded to people and organisations who have worked to reduce armed conflict and build international solidarity. The Nobel Peace Center, opened in 2005, tells their stories year-round.

**Breadcrumb:**
> On the plaza or at the entrance, find the display or banner showing the most recent Nobel Peace Prize laureate. Who received it, and for what?

**Challenge:**
> Inside the center, find the laureate you know least about — the one whose name means the least to you. Read their full citation. Write one sentence in your own words explaining why the Nobel Committee chose them. Then: does knowing their story change how you think about peace as a political act?

**Form fields:**
- `photo` — Take a photo of the laureate display or an exhibit that caught your eye
- `boolean` — Did you enter the center?
- `string` — Who is the most recent Nobel Peace Prize laureate?
- `string` — Which laureate did you know least, and why did they win?

**Image source:** Unsplash search "Nobel Peace Center Oslo". Wikimedia Commons: `File:Nobel_Peace_Center_Oslo.jpg` (CC BY-SA). The distinctive lit entrance facade is well-photographed.

---

### 007 — Oslo City Hall (Oslo Rådhuset)

**File:** `007_loc_city_hall.yaml`
**Address:** Rådhusplassen 1, 0037 Oslo
**Coordinates:** lat 59.9115, lon 10.7342

**Title:** The Hall Where the World Watches

**Storyline:**
> Oslo Rådhuset was completed in 1950 — a building process interrupted by occupation and war. Its interior contains a vast mural cycle depicting Norwegian history, labour, and society. Since 1990, it has hosted the Nobel Peace Prize ceremony every 10 December: the moment when the world's attention turns to Oslo, and a name is spoken aloud in a room built by a people who know what it costs to lose a democracy.

**Breadcrumb:**
> Look at the two towers on the main facade. Are they identical? Examine the decorative motifs near the top of each. Note one difference.

**Challenge:**
> Step inside the main hall. Henrik Sørensen's mural cycle covers the walls. Find the section depicting Norwegian workers and craftspeople. Count how many distinct professions you can identify in the scene — fishers, farmers, builders, weavers, and more.

**Form fields:**
- `photo` — Take a photo of the facade or the mural
- `boolean` — Are the two towers identical?
- `string` — What difference did you spot between the towers?
- `number` — How many distinct professions did you count in the mural?
- `radio` — One word for the main hall? → `Grand` / `Austere` / `Warm` / `Surprising`

**Image source:** Unsplash search "Oslo City Hall" — the red brick twin-tower facade from the waterfront is iconic. Wikimedia Commons: `File:Oslo_rådhus_IMG_9291.JPG` (CC BY-SA).

---

## Routes

**File:** `oslo/routes.yaml`

```yaml
inner_circuit:
  description: "A compact 2.5–3 hour loop through the democratic heart of Oslo: parliament, culture, the Nobel Peace Center, and the hall where the prize is awarded."
  locations:
    - 002_loc_stortinget
    - 003_loc_national_theatre
    - 006_loc_nobel_center
    - 007_loc_city_hall

resistance_walk:
  description: "A 3.5–4 hour route that adds the royal refusal and Akershus Fortress — the site of occupation, execution, and collaboration's reckoning — before arriving at the Nobel quarter."
  locations:
    - 001_loc_royal_palace
    - 002_loc_stortinget
    - 003_loc_national_theatre
    - 004_loc_akershus
    - 006_loc_nobel_center
    - 007_loc_city_hall

full_route:
  description: "A 4.5–5 hour full arc from palace to peace: all seven locations including the Norwegian Resistance Museum at Akershus, where ordinary people made impossible choices."
  locations:
    - 001_loc_royal_palace
    - 002_loc_stortinget
    - 003_loc_national_theatre
    - 004_loc_akershus
    - 005_loc_resistance_museum
    - 006_loc_nobel_center
    - 007_loc_city_hall
```

---

## Image Summary

| Location | Suggested search / Wikimedia file |
|---|---|
| City hero (`oslo-hero.jpg`) | Unsplash: "Oslo waterfront" or "Oslo Aker Brygge" — panoramic shots of the harbor with City Hall in background |
| Royal Palace | Unsplash: "Oslo Royal Palace" · Wikimedia: `File:Oslo_Royal_Palace_2013.jpg` |
| Stortinget | Unsplash: "Stortinget Oslo" · Wikimedia: `File:Stortinget_utenifra.jpg` |
| National Theatre | Unsplash: "Nationaltheatret Oslo" · Wikimedia: `File:Nationaltheatret_Oslo.jpg` |
| Akershus Fortress | Unsplash: "Akershus Fortress" · Wikimedia: `File:Akershus_festning_from_Oslofjorden.jpg` |
| Resistance Museum | Wikimedia: search "Hjemmefrontmuseum" — exterior shot on Akershus grounds |
| Nobel Peace Center | Unsplash: "Nobel Peace Center" · Wikimedia: `File:Nobel_Peace_Center_Oslo.jpg` |
| City Hall | Unsplash: "Oslo City Hall" · Wikimedia: `File:Oslo_rådhus_IMG_9291.JPG` |

All Unsplash images are free for commercial use with no attribution required. Wikimedia CC BY-SA images require attribution and share-alike.

---

## Files to Create

```
src/data/text/en/projects/democrats_abroad/cities.yaml          — add oslo entry
src/data/text/en/projects/democrats_abroad/oslo/
  oslo.yaml
  routes.yaml
  001_loc_royal_palace.yaml
  002_loc_stortinget.yaml
  003_loc_national_theatre.yaml
  004_loc_akershus.yaml
  005_loc_resistance_museum.yaml
  006_loc_nobel_center.yaml
  007_loc_city_hall.yaml
```

Forms are inline arrays in each location YAML (no separate `_form_` files needed for Oslo).

---

## Out of Scope

- No voter registration CTA (Oslo is a demo city)
- No separate `_form_` YAML files — forms are inline in location files
- No new code changes — adding YAML files only
- Images are manually sourced and compressed by the user; this spec provides download guidance only
