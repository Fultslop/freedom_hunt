# Images

## Where image files go

All images are stored in:

```
src/data/img/
```

Drop your image file into this folder. That's it — no further configuration needed.

## Naming

Use lowercase letters, numbers, and hyphens. No spaces, no underscores, no special characters.

Good: `peace-palace-main-gate.jpg`
Bad: `Peace Palace Main Gate.jpg`, `peace_palace.JPG`

Including a short location hint in the name helps avoid confusion when there are many images:

```
den-haag-binnenhof-courtyard.jpg
oslo-vigeland-park-entrance.jpg
amsterdam-resistance-museum.jpg
```

## Format and size

JPEG is preferred. Keep files under **1 MB** and no wider than **1200 pixels**. The app displays images at mobile screen widths, so very high resolution does not improve quality but does slow loading.

If you have a large original (from a camera or Unsplash), resize it before adding it. [Squoosh](https://squoosh.app/) is a free browser-based tool that works well.

## Referencing an image in a location

In the location YAML, set the `image` field to the filename only — no path, no subfolder:

```yaml
image: peace-palace-main-gate.jpg
```

Not:

```yaml
image: src/data/img/peace-palace-main-gate.jpg   # wrong — don't include the path
```

## City and project images

City list images (in `cities.yaml`) and project images (in `projects.yaml`) also go in `src/data/img/` and are referenced by filename only, the same way.

## Attribution

If you use a photo from Unsplash or another source, note the photographer credit somewhere (a comment in the YAML, a spreadsheet, a Notion page — wherever the team tracks this). The app does not display attribution automatically.
