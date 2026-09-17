# Reworld development

- GitHub vivi0915/reworld-frontend is the canonical source. Reuse this checkout and commit history. Avoid export copies and repeated local dependency installations; prefer Actions for CI.
- Preserve the existing visual style and Guest access. Do not build menu/card CMS.
- Never commit credentials, password hashes from real accounts, database files, member exports, Sites metadata or private provisioning migrations.
- Preserve applied migrations and production data. The current Sites deployment has a private administrator provisioning/reset migrations 0003 and 0004 not included here; coordinate future migration numbering (0006 onward; 0005 is the optional-phone migration) when updating that deployment.
- Run typecheck, lint and npm test. Tests must use disposable data, never production accounts.
- The current chatgpt.site production deployment is separate from optional Cloudflare deployment. Do not claim GitHub pushes update it automatically. Cloudflare deployment stays disabled until its target and secrets are configured.
