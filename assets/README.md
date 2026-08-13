# assets

The plugin's only visual assets are the two header icons:

- `speaker_on.svg` — speaker with sound waves (audible state)
- `speaker_muted.svg` — speaker with strike-through slash (muted state)

These files are the **canonical SVG sources**. The client bundler (tsdown)
has no SVG loader, so the identical markup is mirrored inline as React JSX in
`../src/client/icons.tsx` (`SpeakerOnIcon` / `SpeakerMutedIcon`) with
`fill="currentColor"` so the glyphs follow the shell theme. When the markup
changes, update both copies.

No raster assets, no delegated artwork — everything audible is WebAudio
synthesized at runtime.
