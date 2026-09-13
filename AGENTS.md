# Repository Guidelines

This repository is a Jekyll static personal website published by GitHub Pages. It uses Liquid templates, Sass with a vendored Primer stylesheet, vanilla JavaScript for the theme control, Ruby gems for the build, and Node tooling for browser and accessibility checks.

## Project map

- `_config.yml` — site defaults, GitHub metadata, projects, social profiles, and publish exclusions.
- `_layouts/` and `_includes/` — page shells and reusable Liquid components.
- `_posts/` — dated Markdown articles with Jekyll front matter.
- `assets/styles.scss` and `assets/theme.js` — theme tokens, component styling, and the system/light/dark preference control.
- `_data/` — social icon definitions and color data.
- `tests/` — temporary-fixture browser checks for rendered themes, metadata safety, contrast, and accessibility.
- `robots.txt`, `humans.txt`, `llms.txt`, `pgp.txt`, and `.well-known/security.txt` — public crawler, agent, credit, identity, and security-contact metadata.
- `.github/workflows/` — static checks and the GitHub Pages build/deploy workflow.
- `Gemfile`/`Gemfile.lock` and `package.json`/`package-lock.json` — locked Ruby and Node toolchains.

<important if="you need to build, test, lint, or validate the site">

Run commands from the repository root. Install dependencies with `bundle install` and `npm ci`.

| Command | Purpose |
|---|---|
| `npm test` | Build isolated Jekyll fixtures and test Chromium, Firefox, and WebKit, including accessibility and theme persistence. |
| `bundle exec jekyll build` | Build the production site locally. Use `RUBYOPT="-r$PWD/.github/ruby-compat.rb"` when the compatibility shim is needed. |
| `npx --no-install eslint assets/theme.js tests/themes.mjs` | Lint JavaScript. |
| `npx --no-install prettier --check .github/workflows/*.yml package.json package-lock.json eslint.config.mjs` | Check formatting for workflow and tooling files. |
| `ruby -wc .github/ruby-compat.rb` | Check the Ruby compatibility shim. |
| `bundle check` | Confirm the locked Ruby dependencies are installed. |
| `npm audit --audit-level=high` | Audit Node dependencies for high-severity issues. |
| `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7` | Lint GitHub Actions workflow syntax. |
| `npx playwright install chromium firefox webkit` | Install local browser binaries when needed by `npm test`. |

The CI `checks.yml` workflow runs the same static checks and browser suite. The `deploy.yml` workflow builds and deploys only from `main`.

</important>

<important if="you are changing Liquid templates or rendering GitHub metadata">

- Treat GitHub API values as untrusted text. Preserve the existing `escape`, `strip_html`, `strip_newlines`, and `xml_escape` handling in `_includes/header.html` and escape values in attributes and visible markup.
- Validate URLs before emitting links or images; do not allow `javascript:` or other unsafe schemes from configurable metadata.
- Keep generated pages free of validation tooling. Update `_config.yml` exclusions if new local-only directories or files are added.

</important>

<important if="you are changing themes, icons, or browser behavior">

- Preserve the `system` default and the System → Light → Dark cycle in `assets/theme.js`; keep storage failure and older `matchMedia` behavior working.
- Define color changes through the variables in `assets/styles.scss`. Use `currentColor` for monochrome SVG paths and retain `--color-icon-cutout` for two-tone details.
- Keep the same-origin theme script early in `_includes/header.html` and keep its CSP compatible with `script-src 'self'`.
- Run `npm test` across all three browsers after visual or interaction changes; the suite also checks typography, contrast, keyboard activation, persistence, and Axe violations.

</important>

<important if="you are adding a post or changing site content">

- Put posts in `_posts/` with `YYYY-MM-DD-title.md` names and valid YAML front matter.
- Keep social profiles and supported icon markup in `_config.yml` and `_data/social_media.yml`; do not duplicate service URL logic in templates.
- Do not commit credentials, tokens, generated `_site/` output, browser artifacts, or local dependency directories.

</important>

<important if="you are changing crawler, agent, security, or identity metadata">

- Keep `robots.txt` limited to crawl guidance and its absolute `Sitemap` URL; it is not an access-control mechanism.
- Keep `llms.txt` concise, truthful, and link-based. It is a proposed agent-readable index and does not replace `robots.txt`.
- Maintain `.well-known/security.txt` as UTF-8 plain text with an HTTPS `Contact`, `Policy`, `Canonical`, and a renewed `Expires` date before it becomes stale.
- `pgp.txt` must contain public material only. Refresh it from the Keybase account when the primary fingerprint changes; never commit a private key.
- Treat `humans.txt` as optional public credit. Include only people and contact details that are intentionally public.

</important>

<important if="you are changing dependencies or GitHub Actions workflows">

- Update the matching lockfile and run `npm ci`, `bundle check`, the relevant audits, Prettier, and actionlint before delivery.
- Keep third-party Actions pinned to full commit SHAs with version comments, retain least-privilege permissions, and preserve `BUNDLE_FROZEN` in CI.
- Keep `include-hidden-files: true` on `upload-pages-artifact` because the public `.well-known/` metadata is intentionally deployed; review hidden build output before changing this setting.
- Changes to `main` trigger deployment. Verify the exact pushed SHA and terminal workflow conclusions with `gh`; an older green run does not validate a new commit.

</important>

<important if="you are committing, pushing, or cleaning Git state">

- Inspect `git status`, worktrees, and branches before editing. Preserve unrelated changes and generated files owned by another task.
- For an authorized direct push, fetch `origin/main`, confirm there is no divergence, validate locally, stage only intended paths, and push `main`. Then fetch again and prove `HEAD == origin/main` and `git rev-list --left-right --count HEAD...origin/main` is `0 0`.
- Before removing a temporary worktree, inspect its status and preserve uncommitted or untracked work if it is not task-owned. Remove the worktree before deleting its local branch, then run `git worktree prune` and verify both registration and filesystem absence.
- Delete remote branches only when they are explicitly identified as temporary or the user explicitly requests remote cleanup. Keep the repository's persistent branches and unrelated worktrees.

</important>
