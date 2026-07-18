# Deploying PRAHARI to Zoho Catalyst

Live URL: https://prahari-60076064719.development.catalystserverless.in/app/index.html

Catalyst project **PRAHARI** (`48284000000023001`), IN datacenter,
environment *Development*.

---

## The four commands

Run from the repo root, in PowerShell.

```powershell
cd frontend; npm run build; cd ..
robocopy frontend\dist client /E /XD districts scenarios
```

```powershell
# robocopy never deletes: prune bundles that are no longer in dist
$keep = Get-ChildItem frontend\dist\assets -File | Select-Object -ExpandProperty Name
Get-ChildItem client\assets -File | Where-Object { $keep -notcontains $_.Name } | Remove-Item -Force
```

```powershell
npx zcatalyst-cli deploy --only client
```

Then verify with a cache-buster — **Catalyst caches `index.html`**, so a plain
reload will show you the *previous* build's assets and send you chasing bugs
that no longer exist:

```
https://prahari-60076064719.development.catalystserverless.in/app/index.html?v=2
```

---

## Things that will bite you

**`robocopy` exit codes 0–7 mean success.** Anything ≥ 8 is a real failure.
PowerShell surfaces 1–7 as an error; ignore that. Do not run robocopy through
the Bash tool with forward-slash paths — it fails with exit 16.

**`catalyst.json` must stay a plain client**, not the React plugin:

```json
{ "client": { "source": "client" } }
```

The plugin rebuilds from `react-app/` (the stale `catalyst init` scaffold) and
deploys the template app instead of ours.

**`client/client-package.json` name must be `react-app`** — it has to match
what was registered at `catalyst init`. Renaming it breaks the deploy.

**`vite.config.ts` needs `base: '/app/'`.** Catalyst serves the client under
`/app/`; without this every asset 404s and you get a blank page.

**Catalyst rejects a client ZIP over ~500 files**
(`ZIPSANITIZER_FILES_COUNT_EXCEEDED`). This is why `robocopy` excludes
`districts` and `scenarios` — those 460 tiny patrol files are pre-merged into
`patrol_bundle.json` by `bundle_patrol.py`. If you re-add them, the deploy
fails.

**Catalyst does not gzip `.geojson`.** Measured: encoded size == decoded size.
Every map file must be served as `.json` (`optimize_geojson.py` does the
rename). The district-scope hotspot file goes from 13.6 MB uncompressed to
227 KB on the wire because of this one thing.

**`HEAD` requests return 400.** If you are probing for missing files, use
`GET` — `HEAD` will make every file look broken.

---

## After re-running the Python pipeline

`copy_data.py` writes raw `.geojson` and the split patrol tree, which undoes
the three optimisations above. Always follow it with:

```bash
python copy_data.py
python optimize_geojson.py
python strip_insignificant.py
python bundle_patrol.py
```

Skipping these does not break the build — it silently ships a version that is
several times slower and whose ACT tab has no data.

---

## Catalyst project binding

`.catalystrc` is gitignored (it targets our deployment). To recreate it on a
fresh clone, run `catalyst init` and select the existing project, or write it
by hand with these values:

| Field | Value |
|---|---|
| Project name | PRAHARI |
| Project ID | `48284000000023001` |
| Environment | Development (`60076064719`) |
| Domain | `prahari-60076064719.development` |
| Datacenter | IN |
| Timezone | Asia/Kolkata |

## Dataset path

The pipeline no longer hardcodes a developer's local path. Set
`PRAHARI_DATASET_DIR` to your extracted `submission_dataset` folder, or place
it at `<repo>/dataset`. See `.env.example`.
