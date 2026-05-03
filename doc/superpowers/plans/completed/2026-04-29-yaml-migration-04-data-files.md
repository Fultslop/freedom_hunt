# Task 4: Migrate Non-Location Data Files + Update Hooks

Create YAML equivalents of the 7 non-location files, update both hooks to load `.yaml` instead of `.json`, then delete the old JSON files. All 15 tests should pass after this step.

**Files:**

- Create: `src/data/text/en/application.yaml`
- Create: `src/data/text/en/projects/projects.yaml`
- Create: `src/data/text/en/projects/democrats_abroad/democrats_abroad.yaml`
- Create: `src/data/text/en/projects/democrats_abroad/cities.yaml`
- Create: `src/data/text/en/projects/democrats_abroad/den_haag/den_haag.yaml`
- Create: `src/data/text/en/projects/democrats_abroad/den_haag/routes.yaml`
- Create: `src/data/text/en/test_fixture.yaml`
- Modify: `src/hooks/useText.js`
- Modify: `src/hooks/useLocations.js`
- Delete: all 7 `.json` files listed above

---

- [ ] **Step 1: Create `src/data/text/en/application.yaml`**

```yaml
app.title: "Freedom Hunt"
app.tagline: "A scavenger hunt for American expats"
```

- [ ] **Step 2: Create `src/data/text/en/projects/projects.yaml`**

```yaml
page.title: "Choose a project"
page.subtitle: "Select an organisation to hunt with"
items:
  - id: democrats_abroad
    name: "Democrats Abroad"
    description: "American expats standing up for democracy, one city at a time."
```

- [ ] **Step 3: Create `src/data/text/en/projects/democrats_abroad/democrats_abroad.yaml`**

```yaml
style: "GWC"
project.title: "Democrats Abroad"
project.description: "Democrats Abroad is the official arm of the US Democratic Party for Americans living outside the United States. This scavenger hunt connects the history of European resistance to fascism with the stakes of American democracy today."
project.cta: "Choose a city to start your hunt."
```

- [ ] **Step 4: Create `src/data/text/en/projects/democrats_abroad/cities.yaml`**

```yaml
page.title: "Choose a city"
items:
  - id: den_haag
    name: "Den Haag"
    country: "Netherlands"
    description: "The seat of Dutch government and international justice."
```

- [ ] **Step 5: Create `src/data/text/en/projects/democrats_abroad/den_haag/den_haag.yaml`**

```yaml
city.title: "Den Haag"
city.country: "Netherlands"
city.tagline: "Where law meets history"
city.description: "The Hague is home to the Dutch parliament, the International Court of Justice, and a wartime resistance history that speaks directly to the stakes of democracy."
```

- [ ] **Step 6: Create `src/data/text/en/projects/democrats_abroad/den_haag/routes.yaml`**

```yaml
short_walk:
  description: "A 90-minute introduction. 3 stops."
  locations:
    - 001_loc_binnenhof
    - 002_loc_vredespaleis
    - 003_loc_plein
```

- [ ] **Step 7: Create `src/data/text/en/test_fixture.yaml`**

```yaml
hello: world
```

- [ ] **Step 8: Update `src/hooks/useText.js`**

Change the glob pattern and key to use `.yaml`:

```js
import { useState, useEffect, useContext } from "react";
import { LanguageContext } from "../i18n/LanguageContext";

const modules = import.meta.glob("../data/text/**/*.yaml");

export function useText(path) {
  const { currentLang } = useContext(LanguageContext);
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = `../data/text/${currentLang}/${path}.yaml`;
    const loader = modules[key];
    if (!loader) {
      setText(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    loader()
      .then((mod) => {
        setText(mod.default);
        setLoading(false);
      })
      .catch(() => {
        setText(null);
        setLoading(false);
      });
  }, [currentLang, path]);

  return { text, loading };
}
```

- [ ] **Step 9: Update `src/hooks/useLocations.js`**

Change the glob pattern and key to use `.yaml`:

```js
import { useState, useEffect, useContext } from "react";
import { LanguageContext } from "../i18n/LanguageContext";

const modules = import.meta.glob("../data/text/**/*.yaml");

export function useLocations(paths) {
  const { currentLang } = useContext(LanguageContext);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!paths || paths.length === 0) {
      setLocations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(
      paths.map((path) => {
        const key = `../data/text/${currentLang}/${path}.yaml`;
        const loader = modules[key];
        return loader ? loader().then((m) => m.default) : Promise.resolve(null);
      }),
    )
      .then((results) => {
        setLocations(results.filter(Boolean));
        setLoading(false);
      })
      .catch(() => {
        setLocations([]);
        setLoading(false);
      });
  }, [currentLang, JSON.stringify(paths)]);

  return { locations, loading };
}
```

- [ ] **Step 10: Run tests to verify all pass**

```bash
npm run test:run
```

Expected: all 15 tests pass. Vitest resolves `import.meta.glob` against the real file system, so `test_fixture.yaml` is picked up automatically.

- [ ] **Step 11: Delete the old JSON files**

```bash
rm src/data/text/en/application.json
rm src/data/text/en/projects/projects.json
rm src/data/text/en/projects/democrats_abroad/democrats_abroad.json
rm src/data/text/en/projects/democrats_abroad/cities.json
rm src/data/text/en/projects/democrats_abroad/den_haag/den_haag.json
rm src/data/text/en/projects/democrats_abroad/den_haag/routes.json
rm src/data/text/en/test_fixture.json
```

- [ ] **Step 12: Run tests again to confirm deletion didn't break anything**

```bash
npm run test:run
```

Expected: all 15 tests pass.

- [ ] **Step 13: Commit**

```bash
git add src/data/text/en/ src/hooks/useText.js src/hooks/useLocations.js
git commit -m "feat: migrate non-location data files from JSON to YAML"
```
