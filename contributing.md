# Contributing to TalkingHead

Thanks for wanting to help! 🎉 Whether it's a typo fix or a new feature, every contribution makes TalkingHead better for everyone.

## Ways to contribute

- 🐛 **Report bugs.** Open an issue with steps to reproduce, your OS and browser, and your Node version.
- 💡 **Suggest features.** Open an issue or a Discussion before starting something large.
- 📝 **Improve docs.** Clearer README, more examples, tutorials and translations.
- 🔧 **Write code.** Pick an issue labelled `good first issue` or `help wanted`, or one from the roadmap in the README.
- 🎨 **Share what you built.** Add your project to a "Built with TalkingHead" list through a PR or Discussion.

## Development setup

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/<your-username>/TalkingHead.git
cd TalkingHead
npm install
cp .env.example .env     # add GROQ_API_KEY only if you work on /api/chat
npm start                # http://localhost:3000
```

Requirements: Node.js v18 or higher.

## Pull request workflow

1. **Create a branch** from `main`:
   `git checkout -b feature/short-description` or `fix/short-description`
2. **Make focused changes.** One topic per PR is easier to review.
3. **Test manually.** Run the app and exercise the endpoints you touched (`/api/speak`, `/api/gesture` and so on).
4. **Update docs** (README, INTEGRATION.md) if behavior or payloads changed.
5. **Commit with clear messages.** We like [Conventional Commits](https://www.conventionalcommits.org/):
   `feat: add WebSocket endpoint`, `fix: handle empty text in /api/speak`, `docs: clarify iframe usage`
6. **Open a PR** and explain what changed and why. Screenshots or GIFs are great for UI changes.

### PR checklist

- [ ] The app starts with `npm start` and the change works
- [ ] No API keys, secrets or `.env` contents are committed
- [ ] Docs are updated where needed
- [ ] The PR description explains the motivation

## Good first issue ideas

- Add a "Built with TalkingHead" section and a first example
- Add copy-paste examples for LangChain, LlamaIndex or the Vercel AI SDK
- Write an OpenAPI spec for the REST endpoints
- Add a Dockerfile
- Improve error messages for invalid `mood`, `gesture` or `frame` values
- Add a GitHub Actions workflow that installs dependencies and starts the server

## Assets and licensing

- By contributing, you agree your contributions are licensed under the project's [MIT License](LICENSE).
- Only add avatars, animations, audio or images you have the right to redistribute, and state their license in your PR.
- Don't commit raw Mixamo animation files or avatars with non-redistributable licenses.

## Code of Conduct

Be kind, be respectful and assume good intent. Harassment or discrimination of any kind is not tolerated. Maintainers may remove comments, issues or contributions that violate this.

## Questions?

Open a [Discussion](https://github.com/thesuraj01/TalkingHead/discussions) or an issue. Happy hacking! 🚀