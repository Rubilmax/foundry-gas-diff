# 🔥🛠️ Foundry Gas Diff Reporter

- An awesome description to complete

## Setup

A full setup guide to complete

## Usage

### Automatically generate a gas report diff on every PR

Add a workflow (`.github/workflows/foundry-gas-report.yml`):

```yaml
name: Report gas diff

on:
  pull_request:
    # Optionally configure to run only for specific files. For example:
    # paths:
    # - "src/**"

jobs:
  build_and_preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # Add any build steps here. For example:
      - run: forge test --gas-report

      - uses: Rubilmax/foundry-gas-report@v0
        with:
          token: "${{ secrets.GITHUB_TOKEN }}"
```

## Options

### `token` _{string}_ (required)

Adding `token: "${{ secrets.GITHUB_TOKEN }}"` lets the action comment on PRs
with the preview URL for the associated preview channel. You don't need to set
this secret yourself - GitHub sets it automatically.

## Status

![Status: Experimental](https://img.shields.io/badge/Status-Experimental-blue)

This repository is maintained independently from [Foundry](https://github.com/foundry-rs/foundry) and may not work as expected with all versions of `forge`.
