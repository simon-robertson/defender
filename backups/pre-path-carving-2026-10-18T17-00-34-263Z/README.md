# Landscape backup before path carving

Created 2026-10-18T17:00:34.263Z. Exact copies of all **16 approved 20×16-box (480×384-unit) landscapes**, with no paths, enemies, defences or reserved clearings. Includes **51 referenced scenery and cosmetic wildlife model files**, terrain/water/environment settings, placement details and authored wildlife seeds/perches. No active source was changed.

This is a frozen rollback copy independent of the regeneratable snapshots under docs/. **Do not edit it or write future carving into it.** Create a new timestamped backup for a later milestone. The adjacent .tar.gz archive contains the same files and has a separate SHA-256 checksum.

## Verify

From this backup directory, run:

```sh
shasum -a 256 -c SHA256SUMS
```

## Restore the landscapes later

First preserve any carved versions you want to retain. Verify this backup, then from the project root run:

```sh
cp backups/pre-path-carving-2026-10-18T17-00-34-263Z/assets/levels/*.json assets/levels/
```

This restores exactly these sixteen level sources, including scenery placements, terrain, water, weather and wildlife metadata. Refresh the existing game tab afterward. The live files retain their existing permissions when overwritten.

The matching model sources are under assets/models/ in this backup. Restore only relevant models if they have since changed and that rollback is intended; ordinary path carving should not modify shared models. No engine code, dependencies or derived GPU meshes are restored. To use the compressed copy, extract it into a separate temporary directory and verify SHA256SUMS before copying sources.

manifest.json records each source path, byte size and SHA-256 digest. SHA256SUMS also covers this README and the manifest.
