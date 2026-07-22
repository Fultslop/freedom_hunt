# YAML Basics

YAML is a plain-text format for structured data. All hunt content is written in YAML files (`.yaml`). This page covers the rules you need to know.

## Key-value pairs

The most basic thing in YAML is a key and a value separated by a colon and a space:

```yaml
title: "The Peace Palace"
address: "Carnegieplein 2"
```

## Indentation

Indentation creates structure — it shows that something belongs inside something else. **Use spaces, not tabs.** Two spaces per level is the convention used in this project.

```yaml
challenge:
  description: |
    Find the mosaic near the main gate.
  notes: "Ask the guard if you get stuck."
```

`description` and `notes` belong inside `challenge` because they are indented under it. If you accidentally use a tab, the file will fail validation with a cryptic error.

## Strings

**Plain strings** — no quotes needed unless the value starts with a special character:

```yaml
title: Peace Palace
address: Carnegieplein 2
```

**Quoted strings** — use double quotes if the value contains a colon, hash, or other YAML special character:

```yaml
name: "The Peace Palace: Home of International Justice"
```

**Multi-line strings** — use a pipe `|` to write text across multiple lines. The text starts on the next line, indented two more spaces. Line breaks are preserved:

```yaml
storyline: |
  Built in 1913, the Peace Palace houses the International Court of Justice.
  It stands on the belief that law, not war, should settle disputes between nations.

  Today it is the principal judicial organ of the United Nations.
```

Note the blank line between paragraphs — that creates a paragraph break in the rendered text. Markdown formatting (`**bold**`, `_italic_`) is supported in `storyline` and `breadcrumb` fields.

## Lists

A list is written as items prefixed with a dash and a space:

```yaml
locations:
  - 001_loc_binnenhof
  - 002_loc_vredespaleis
  - 003_loc_plein
```

Form files are also lists — each field is a list item that can itself have keys:

```yaml
- id: found_plaque
  type: boolean
  label: Did you find the plaque?
- id: motto_text
  type: string
  label: What is the motto?
```

## Booleans

Use lowercase `true` or `false`:

```yaml
isRequired: true
```

Do not use `yes`, `no`, `Yes`, `True`, etc. — different YAML parsers treat them differently.

## Common mistakes

| Mistake | What goes wrong |
|---------|----------------|
| Using a tab instead of spaces | File fails to parse — you get a YAML error with a misleading line number |
| Forgetting the space after `:` | `title:"text"` is invalid; it must be `title: "text"` |
| Putting a colon inside an unquoted string | `name: Café: the place` is invalid — quote it: `name: "Café: the place"` |
| Inconsistent indentation | Two spaces in one place, four in another — YAML will misread the structure |
| Trailing spaces on a blank line inside a `\|` block | Can cause unexpected whitespace in rendered text |

## VS Code tip

If you use VS Code, the repository is already configured to show schema errors as red squiggles in YAML files. Install the **YAML** extension by Red Hat (`redhat.vscode-yaml`) to enable this. It will tell you immediately if a field is missing or has the wrong type, before you even commit.
