# Git Workflow

How to set up your environment and submit content changes.

## Prerequisites

- **Git** installed on your computer — [git-scm.com/downloads](https://git-scm.com/downloads)
- **A GitHub account** with access to the repository
- **A text editor** — [VS Code](https://code.visualstudio.com/) is recommended because it highlights YAML errors as red squiggles automatically

## First time: clone the repository

Open a terminal, navigate to where you keep projects, and run:

```bash
git clone <repository-url>
cd freedom_hunt
```

Get the repository URL from the GitHub page (green **Code** button → **HTTPS**).

## Every time: create a branch

Never edit files directly on `main`. Always create a new branch for your changes:

```bash
git checkout main
git pull
git checkout -b content/add-oslo-locations
```

Use a short, descriptive name. The `content/` prefix keeps content branches easy to recognise.

## Make your changes

Edit or create YAML files in `src/data/text/en/projects/`. See the other pages in this guide for what to write.

## Commit your changes

Stage the files you changed, then commit with a short message:

```bash
git add src/data/
git commit -m "content: add three Oslo locations"
```

A good commit message says what you added, not how you did it.

If you're also adding images, stage those too:

```bash
git add src/data/img/
git add src/data/text/
git commit -m "content: add Vigeland Park location and photo"
```

## Push and open a pull request

```bash
git push origin content/add-oslo-locations
```

Then open the repository on GitHub. You should see a yellow banner offering to open a pull request for your branch — click **Compare & pull request**. Write a one- or two-sentence description of what you added, then click **Create pull request**.

## Reading CI results

GitHub runs four automated checks when you open a PR. You can see them at the bottom of the pull request page.

If the **Validate YAML** check fails (the most common failure for content changes), click **Details** and look for lines starting with `ERROR:`. For example:

```
ERROR: src/data/text/en/projects/democrats_abroad/oslo/005_loc_market.yaml:
  /challenge: must NOT have additional properties ('form_fields')
```

This tells you:
- **Which file** has the problem (`005_loc_market.yaml`)
- **Where in the file** the problem is (`/challenge` means inside the `challenge:` block)
- **What the problem is** (an unrecognised key called `form_fields`)

Fix the file, commit the fix, and push again. The checks re-run automatically.

## Keeping your branch up to date

If `main` has moved on while you were working, update your branch before pushing:

```bash
git fetch origin
git rebase origin/main
```

If there are conflicts, Git will tell you which files to fix. Open them, resolve the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`), save, then run:

```bash
git add <file>
git rebase --continue
```
