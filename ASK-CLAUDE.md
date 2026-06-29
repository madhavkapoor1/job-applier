# Customising the app with Claude

Most things you'll want to change need **no coding** — just use the **Your Profile** tab in the
app. But if you want to tailor it more deeply, you can ask **Claude** to edit it for you.

## The no-Claude way (easiest)

Open the app and use the **Your Profile** tab to change:
- your details, summary, skills, and work experience
- the **keywords / job titles** it searches for
- **locations** (London, UK-wide, remote)
- which **job sources** are on

That covers most needs. Only read on if you want changes the form doesn't offer.

## Using Claude to tailor it

1. Install **Claude Code** from https://claude.com/claude-code (free to try).
2. Open this project folder in it.
3. Type one of the prompts below (or your own). Claude already understands this project — there's
   a `CLAUDE.md` file that explains how everything fits together.

### Ready-to-use prompts

**Change what kind of jobs it looks for**
> "I'm a paralegal moving into ESG and AI policy work. Update the search keywords, skills, and
> The Muse category so it finds those roles, and re-run discovery to show me the results."

**Make the cover letters sound more like me**
> "Rewrite `templates/cover-letter.md` to sound warmer and less formal, and make it mention my
> interest in [topic]. Then prepare a fresh application so I can see the new style."

**Add companies I want to track**
> "Add these companies' career pages to the job sources: [names]. Find their Greenhouse/Lever/
> Ashby handles, add them to the config, and run a search."

**Search a different city or go UK-wide**
> "Change my locations to [e.g. Manchester, or 'anywhere in the UK'] and re-run the search."

**Turn on more job sources**
> "Help me set up the free Reed and Adzuna API keys so I get many more UK jobs, and switch them on."

**Just describe your situation**
> "Here's my CV [paste it]. Please fill in my profile, set sensible keywords for my experience,
> and prepare my first batch of applications."

Claude will make the changes, run the app to check them, and explain what it did. Your data stays
on your computer.
