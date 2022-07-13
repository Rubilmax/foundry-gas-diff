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
  push:
    branches:
      - main
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
      - run: forge test --gas-report > gasreport.ansi

      - uses: Rubilmax/foundry-gas-report@v0
        with:
          token: "${{ secrets.GITHUB_TOKEN }}"
```

## Options

### `token` _{string}_ (required)

The github token lets the action upload the gas report once it's been pushed

### `report` _{string}_

This should correspond to the path of a file where the output of forge's gas report has been logged.

_Defaults to: `gasreport.ansi`_

### `outReport` _{string}_

_You usually want to leave this blank_ so that each PR saves its own gas report which can easily be identifiable.

### `refReport` _{string}_

_You usually want to leave this blank_ so that each PR uses the base branch's gas report as a reference.

## Status

![Status: Experimental](https://img.shields.io/badge/Status-Experimental-blue)

This repository is maintained independently from [Foundry](https://github.com/foundry-rs/foundry) and may not work as expected with all versions of `forge`.
