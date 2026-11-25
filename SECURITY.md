# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles: the address of your Chatterbox-TTS-Server, the
language, voice names and speech settings, stored by Gladys in the integration
configuration (nothing is written under `/data`, no secret is asked). The texts
to speak are sent in HTTP (or HTTPS) to the server you configure, on your local
network, and kept in memory only (the 16 latest clips); they are never written
to the logs. An address with a user name or password is refused.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and Chatterbox-TTS-Server, the Chatterbox models and voices (see
[devnen/Chatterbox-TTS-Server](https://github.com/devnen/Chatterbox-TTS-Server)
and [resemble-ai/chatterbox](https://github.com/resemble-ai/chatterbox)).
