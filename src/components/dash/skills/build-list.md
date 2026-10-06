---
name: build-list
description: Build a list of contacts or companies from the saved book and live search. Never invent emails, phones, or company facts.
---

# Build list

Use when asked for a targeted list: titles, industries, cities, or company size.

## Workflow

1. Decide contacts, companies, or both. Titles mean contacts. Firmographics only mean companies.
2. Restate the filters in a table before searching: title, industry, location, size, and any extra rule.
3. Search the saved contact book first with `/contacts`. Then `/search` for public pages that match.
4. Default to 25 rows. Never pad the list with made-up people.
5. A row may include a name, title, company, city, and a source URL. Leave email and phone blank unless they are already saved on the board.
6. End with how many rows are real, which filters were used, and one way to narrow or widen the list.

## Output

| # | Name | Title | Company | Email | Phone | Location | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |

If a field is not on the board or in the search hit, write unknown.
