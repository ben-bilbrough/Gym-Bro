# Gym Bro

A simple workout tracker that runs as a Home Screen web app on iPhone. All data stays on your phone.

## Put it online with GitHub Pages
1. Create a new public repository on github.com called `gym-bro`.
2. Click **Add file → Upload files**, drag in every file from this folder, then **Commit changes**.
3. Go to **Settings → Pages**. Under *Build and deployment*, set Source to **Deploy from a branch**, Branch to **main** and folder **/ (root)**, then **Save**.
4. After about a minute your app is at `https://<your-username>.github.io/gym-bro/`.

## Install on iPhone
Open that link in **Safari**, tap **Share → Add to Home Screen**, then open Gym Bro from the Home Screen.

## Backups
Menu (•••) → **Back up data** downloads a file you can restore later with **Restore backup**.

## Updating
After changing files, edit the `VERSION` line in `sw.js` (e.g. `gymbro-v2`) so phones pick up the new version.
