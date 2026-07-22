# Content Authoring Guide

This guide is for people adding or editing hunt content — locations, forms, routes, and cities — by editing YAML files directly in the repository.

## Pages

| Page | What it covers |
|------|----------------|
| [Git workflow](git-workflow.md) | Set up your environment, create a branch, commit, push, and open a PR |
| [YAML basics](yaml-basics.md) | YAML syntax rules and the most common mistakes |
| [Locations](locations.md) | Add or edit a hunt stop |
| [Forms](forms.md) | Add the form participants fill in at a location |
| [Routes and cities](routes-and-cities.md) | Add locations to routes, create new routes, add cities |
| [Images](images.md) | Add a photo for a location |

## Typical workflow for adding a location

1. Create a branch — see [Git workflow](git-workflow.md)
2. Add the location file — see [Locations](locations.md)
3. Add a form file if the location has one — see [Forms](forms.md)
4. Add the location to the right route — see [Routes and cities](routes-and-cities.md)
5. Drop the image into the right folder — see [Images](images.md)
6. Commit, push, and open a pull request — see [Git workflow](git-workflow.md)

## Automated checks

Every pull request runs four checks automatically on GitHub. The one most relevant to content changes is **Validate YAML** — it checks all location and form files against the project schema. If it fails, click **Details** to read the error message and fix the file.

The other three checks — **Typecheck**, **Lint**, and **Tests** — cover the application code, not content files. If they fail for no apparent reason, ask a developer.
