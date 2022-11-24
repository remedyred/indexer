# @snickbit/indexer Changelog

## [2.6.0](https://github.com/remedyred/indexer/compare/v2.5.28...v2.6.0) (2022-11-24)


### Features

* better default exports ([#55](https://github.com/remedyred/indexer/issues/55)) ([4174737](https://github.com/remedyred/indexer/commit/4174737ea11746c0b4784f51eb25cbcee29a6fc6))
* split cli and library ([#53](https://github.com/remedyred/indexer/issues/53)) ([f53c1dd](https://github.com/remedyred/indexer/commit/f53c1dd20969dca12b0c9d4a9753fc6d4e53e57e))


### Bug Fixes

* **ci:** switch to release please ([b4ce12c](https://github.com/remedyred/indexer/commit/b4ce12c43eef5c8d2962f2811bb38864cb66d54e))
* improve type exports ([#56](https://github.com/remedyred/indexer/issues/56)) ([4c09d2f](https://github.com/remedyred/indexer/commit/4c09d2f598ae4ed655410ac892be61bec13b3679))

## 2.5.7

### Patch Changes

- [2f9f291](https://github.com/snickbit/indexer/commit/2f9f291) **fix**:  re-enable saving configuration on init

## 2.5.6

### Patch Changes

- [abed335](https://github.com/snickbit/indexer/commit/abed335) **fix**:  add argument for output, adjusted descriptions to clarify that source and output are only for initial run
- [f07dda3](https://github.com/snickbit/indexer/commit/f07dda3) **fix**:  incorrect return type, remove unnecessary type definitions
- [d5abb7c](https://github.com/snickbit/indexer/commit/d5abb7c) **fix**:  replace glob in output input suggestion
- [3b0f9f2](https://github.com/snickbit/indexer/commit/3b0f9f2) **fix**:  ensure source argument is a glob
- [96bf455](https://github.com/snickbit/indexer/commit/96bf455) **fix**:  allow indexer to run by only providing a source argument

## 2.5.5

### Patch Changes

- [caf4663](https://github.com/snickbit/indexer/commit/caf4663) **chore**:  bump dependencies
- [c3f6188](https://github.com/snickbit/indexer/commit/c3f6188) **chore**:  bump dependencies

## 2.5.4

### Patch Changes

- [ff7186f](https://github.com/snickbit/indexer/commit/ff7186f) **docs**:  update
- [c4e1114](https://github.com/snickbit/indexer/commit/c4e1114) **fix**:  use parsed file path for export name instead of original file path
- [6e9da87](https://github.com/snickbit/indexer/commit/6e9da87) **fix**:  add explicit inclusion with "include" config option
- [bebc85d](https://github.com/snickbit/indexer/commit/bebc85d) **fix**:  add debug output
- [c6b8f02](https://github.com/snickbit/indexer/commit/c6b8f02) **fix**:  swap logical operator

## 2.5.3

### Patch Changes

- [78528df](https://github.com/snickbit/indexer/commit/78528df) **docs**:  update
- [73b68e8](https://github.com/snickbit/indexer/commit/73b68e8) **fix**:  remove unused "single" option
- [a831d8e](https://github.com/snickbit/indexer/commit/a831d8e) **fix**:  don't kill on missing source and present indexes array
