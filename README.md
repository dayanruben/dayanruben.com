# Dayan Ruben · Personal Website

[![Checks](https://github.com/dayanruben/dayanruben.com/actions/workflows/checks.yml/badge.svg?branch=main)](https://github.com/dayanruben/dayanruben.com/actions/workflows/checks.yml)
[![Deploy site](https://github.com/dayanruben/dayanruben.com/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/dayanruben/dayanruben.com/actions/workflows/deploy.yml)
[![Live site](https://img.shields.io/website?url=https%3A%2F%2Fdayanruben.com&label=website)](https://dayanruben.com/)
[![Built with Jekyll](https://img.shields.io/badge/built_with-Jekyll-cc0000?logo=jekyll&logoColor=white)](https://jekyllrb.com/)
[![Hosted on GitHub Pages](https://img.shields.io/badge/hosted_on-GitHub_Pages-222222?logo=github&logoColor=white)](https://pages.github.com/)
[![License](https://img.shields.io/github/license/dayanruben/dayanruben.com)](LICENSE.txt)

The source for [dayanruben.com](https://dayanruben.com/), Dayan Ruben's personal website and portfolio. It is a small, accessible, static site for sharing a professional profile, projects, interests, writing, and public contact and identity resources.

The site is built with [Jekyll](https://jekyllrb.com/), [GitHub Pages](https://pages.github.com/), [Primer CSS](https://primer.style/), Sass, and a small amount of vanilla JavaScript. GitHub metadata powers the optional project and profile sections.

## Contents

- [Quick links](#quick-links)
- [Technology](#technology)
- [Run locally](#run-locally)
- [Validate changes](#validate-changes)
- [Update the site](#update-the-site)
- [Public resources](#public-resources)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Security](#security)
- [License](#license)

## Quick links

| Resource          | Link                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------ |
| Live website      | [dayanruben.com](https://dayanruben.com/)                                            |
| Source repository | [github.com/dayanruben/dayanruben.com](https://github.com/dayanruben/dayanruben.com) |
| GitHub profile    | [github.com/dayanruben](https://github.com/dayanruben)                               |
| LinkedIn          | [linkedin.com/in/dayanruben](https://www.linkedin.com/in/dayanruben/)                |
| Keybase           | [keybase.io/dayanruben](https://keybase.io/dayanruben)                               |
| Security policy   | [SECURITY.md](SECURITY.md)                                                           |

## Technology

- **Build:** Jekyll with GitHub Pages-compatible Ruby gems
- **Presentation:** Primer CSS, Sass, Liquid templates, and responsive layouts
- **Interaction:** Same-origin vanilla JavaScript for the system/light/dark theme control
- **Quality:** Playwright browser coverage for Chromium, Firefox, and WebKit, plus Axe accessibility checks
- **Automation:** GitHub Actions for static checks, browser validation, and Pages deployment
- **Runtime used in CI:** Ruby 3.2 and Node.js 22

## Run locally

Install Ruby 3.2, Bundler, Node.js 22, and Git. From the repository root:

```sh
bundle install
npm ci
npx playwright install chromium firefox webkit
```

Start Jekyll with live reload:

```sh
RUBYOPT="-r$PWD/.github/ruby-compat.rb" bundle exec jekyll serve
```

Open [http://127.0.0.1:4000](http://127.0.0.1:4000). The compatibility shim keeps the GitHub Pages dependency set working with current Ruby standard-library packaging; omit <code>RUBYOPT</code> only when your local toolchain does not need it.

## Validate changes

Run the browser and accessibility suite before pushing:

```sh
npm test
```

The suite builds isolated Jekyll fixtures for both layouts and all three theme defaults. It checks theme persistence, system preference changes, keyboard activation, mobile layout, typography, SVG color inheritance, contrast, and Axe violations. Fixtures and screenshots stay outside the published site.

Run the production build and static checks when changing templates, configuration, styles, workflows, or dependencies:

```sh
RUBYOPT="-r$PWD/.github/ruby-compat.rb" bundle exec jekyll build
npx --no-install eslint assets/theme.js tests/themes.mjs
npx --no-install prettier --check .github/workflows/*.yml package.json package-lock.json eslint.config.mjs
ruby -wc .github/ruby-compat.rb
bundle check
npm audit --audit-level=high
git diff --check
```

GitHub Actions runs the same static checks and browser suite for pull requests and manual checks. The workflow files are also linted with [actionlint](https://github.com/rhysd/actionlint).

## Update the site

### Profile, projects, interests, and social links

Edit [_config.yml](_config.yml) for the site title, description, layout, default theme, project filtering, interests, and supported social profiles. Keep profile URLs and public contact details current. Social icons and share URLs are defined in [_data/social_media.yml](_data/social_media.yml).

### Writing

Add a Markdown file to [_posts/](_posts/) using <code>YYYY-MM-DD-title.md</code> and Jekyll front matter:

```markdown
---
title: "A useful title"
---

Your article content.
```

The post layout, Atom feed, and sitemap are generated by Jekyll. A post with <code>published: false</code> remains available in source control without appearing on the public site.

### Pages, templates, and styles

- Add standalone pages at the repository root with <code>layout: default</code> front matter.
- Reuse components in [_includes/](_includes/) and page shells in [_layouts/](_layouts/).
- Update [assets/styles.scss](assets/styles.scss) for visual tokens and component styles.
- Keep theme behavior in [assets/theme.js](assets/theme.js) compatible with system preference, keyboard use, storage failures, and the site's same-origin script policy.

## Public resources

These files are intentionally published beside the HTML site:

| File                                                  | Purpose                                                                                                                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [robots.txt](robots.txt)                              | Crawl guidance and the absolute sitemap URL. It is not access control.                                                                                      |
| [sitemap.xml](https://dayanruben.com/sitemap.xml)     | Generated URL index from <code>jekyll-sitemap</code>.                                                                                                       |
| [feed.xml](https://dayanruben.com/feed.xml)           | Generated Atom feed from <code>jekyll-feed</code>.                                                                                                          |
| [llms.txt](llms.txt)                                  | A concise, link-based overview for assistants and language models. It follows the [proposed llms.txt format](https://llmstxt.org/).                         |
| [humans.txt](humans.txt)                              | Optional credit for the people and open-source projects behind the site.                                                                                    |
| [/.well-known/security.txt](.well-known/security.txt) | Machine-readable vulnerability-reporting contact, policy, encryption key, and expiry metadata. See [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116.html). |
| [pgp.txt](pgp.txt)                                    | The public OpenPGP key published from [Keybase](https://keybase.io/dayanruben). Never replace it with private key material.                                 |
| [CNAME](CNAME)                                        | GitHub Pages custom-domain configuration for <code>dayanruben.com</code>.                                                                                   |
| [/.well-known/nostr.json](.well-known/nostr.json)     | Nostr identity verification metadata.                                                                                                                       |

When changing a security contact, domain, profile, or key, update the relevant files together and verify the generated output. The Pages artifact workflow preserves the hidden <code>.well-known/</code> directory intentionally.

## Project structure

| Path                                     | Responsibility                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| [_config.yml](_config.yml)               | Jekyll settings, site metadata, projects, social profiles, plugins, and publish exclusions |
| [_layouts/](_layouts/)                   | Page and post shells                                                                       |
| [_includes/](_includes/)                 | Shared Liquid components such as the header, masthead, cards, and footer                   |
| [_posts/](_posts/)                       | Dated Markdown articles                                                                    |
| [assets/](assets/)                       | Sass, JavaScript, and vendored Primer CSS                                                  |
| [_data/](_data/)                         | Social service definitions and color data                                                  |
| [tests/](tests/)                         | Temporary-fixture browser, accessibility, metadata, and theme checks                       |
| [.github/workflows/](.github/workflows/) | Static validation and GitHub Pages deployment                                              |
| [AGENTS.md](AGENTS.md)                   | Repository instructions for safe changes and validation                                    |
| [CLAUDE.md](CLAUDE.md)                   | Symlink to <code>AGENTS.md</code> for compatible coding agents                             |

Generated <code>_site/</code>, browser artifacts, <code>node_modules/</code>, and repository-only documentation are excluded from the public build.

## Deployment

Pushing to <code>main</code> triggers [Deploy site](.github/workflows/deploy.yml), which builds the Jekyll site, uploads the artifact, and deploys it to GitHub Pages. The workflow is configured for the custom domain in [CNAME](CNAME) and keeps <code>.well-known/</code> metadata in the artifact.

For a new fork or replacement repository:

1. Enable **Settings → Pages → GitHub Actions** as the build source.
2. Configure the custom domain and its DNS records.
3. Push the desired site version to <code>main</code>.
4. Confirm the deployment and check the generated <code>robots.txt</code>, sitemap, feed, security file, and identity resources on the live domain.

## Security

Read the [security policy](SECURITY.md) before reporting an issue. Use GitHub Private Vulnerability Reporting for suspected vulnerabilities; do not publish exploit details in a public issue. The repository may contain a public OpenPGP key, but it must never contain private keys, credentials, tokens, or generated secrets.

## License

This project is available under the [MIT License](LICENSE.txt). The site began from GitHub's [personal-website](https://github.com/github/personal-website) project; see the repository history and license for attribution.
