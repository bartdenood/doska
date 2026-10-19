---
title: Card templates
nav: Card templates
description: "Save a title, Markdown body, tags, and priority, then start a new card from that template. Blank cards stay one click."
order: 6
updated: "2026-10-19"
---

A template is a starting point for a card: a title, a Markdown body, tags, and a priority. The template's own name is only the label in the menu. It is not copied onto the card.

Templates are global. The same list is offered on every board on this device.

## Where they are stored

They live in the local database, next to your boards: IndexedDB on the web and desktop apps, SQLite on mobile. They survive a reload.

They do not travel with folder sync or server sync. Those channels sync board records (columns and cards). A template is not a card, and adding it to that format would break older clients. Signing in as a different account on the same device clears them, the same way it clears that account's boards. The first sign-in on a device keeps templates you created before you signed in.

## Manage templates

Open **Settings** and choose **Card templates**.

- **New template** asks for a name, then the card's title, body, tags, and priority.
- **Edit** (select the template) changes any of those, including the name. That is how you rename one.
- **Duplicate** copies the card fields under a new name, then opens the copy.
- **Delete** removes the template from this device. Cards you already created from it stay as they are.

## New card

The add-card button still creates a blank card in one click. That is the header **+** and the **+** at the top of a column.

Once you have at least one template, a second button appears beside it. It lists **Blank card**, each template, and **Manage templates**. Choosing a template creates the card with those fields filled in and opens it. A blank card from a column stays on the board, as before. The header **+** still opens the new card.

Adding is blocked while a tag or assignee filter is on, for a blank card and for a template alike.
