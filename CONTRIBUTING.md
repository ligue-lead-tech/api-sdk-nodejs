# Contributing

Thanks for helping improve the LigueLead Node.js SDK.

## How this repository works

The SDK is maintained by the LigueLead team, and each release reaches this repository as a single
commit (`Release vX.Y.Z`) with its tag, which publishes the version to npm. Development happens
elsewhere, so a pull request here is not merged as is: it is read as a proposal. When a change is
accepted, the team applies it and closes the pull request with a link to the release that carries it.

## Issues

Issues are welcome — a bug in the SDK, a missing endpoint, unclear documentation. Please include the
SDK version (`LigueLeadClient.VERSION`), your Node.js version, and the smallest code that shows the
problem. Never paste a real `api-token` or `app-id`.

Questions about your account, billing or the behavior of the API itself go to LigueLead support,
through the [Client Area](https://areadocliente.liguelead.app.br/).

## Security

Do not open an issue for a security problem. See [SECURITY.md](SECURITY.md).

## Running it locally

The commands the CI runs are in the "Development" section of the [README](README.md#development).
The unit tests need no network and no credentials.
