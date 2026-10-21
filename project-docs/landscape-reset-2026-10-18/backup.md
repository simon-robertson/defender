# Backup of approved landscapes before path carving

The user accepted the current landscape appearance and requested a rollback copy before future path carving. Created **2026-10-18T17:00:34.263Z** from the actual active files, without regenerating or modifying levels.

- Snapshot directory: `backups/pre-path-carving-2026-10-18T17-00-34-263Z/` at the project root.
- Compressed archive: `backups/pre-path-carving-2026-10-18T17-00-34-263Z.tar.gz` (464,365 bytes), with an adjacent `.sha256` checksum.
- Contents: all **16** production level JSON files and their **51** referenced scenery/cosmetic wildlife model JSON files; a manifest, checksums and rollback instructions. Terrain, water, placement details, environment settings and wildlife metadata are included.
- Integrity: all **69** checksummed files verified both in the snapshot and after extracting the archive into a separate temporary directory. All 67 backed-up asset files still match the active originals. [Verification record](backup-verification.json).

**Preserve this copy unchanged.** Backup files and the archive are read-only. Future Artist/Tactician work must edit active level sources, never this backup. The reset builder can rewrite its docs snapshots, so those regeneratable copies are not a substitute for this frozen rollback point. Create another timestamped backup for a later milestone.

## Rollback

The snapshot's `README.md` contains verification and restoration instructions. First retain any carved versions worth keeping and verify `SHA256SUMS` inside the snapshot. From the project root, restore only the sixteen level sources with:

```sh
cp backups/pre-path-carving-2026-10-18T17-00-34-263Z/assets/levels/*.json assets/levels/
```

Refresh the existing preview afterward. Shared model copies are included if a later model rollback becomes necessary, but ordinary path carving should not change them; restore relevant models only when intended. This is a local asset backup, not an engine-code snapshot. No active files were restored during backup verification, and no runtime tests or browser reload were needed.
