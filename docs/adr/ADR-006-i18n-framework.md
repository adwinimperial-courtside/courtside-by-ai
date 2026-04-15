# ADR-006 — Internationalisation (i18n) Framework

**Date:** 2026-04-15
**Status:** Decided
**Decider:** Win

---

## Context

Courtside by AI serves users across multiple countries (Finland, Philippines, Spain, Canada). The app must be built with internationalisation infrastructure in place from the start, even if only one language is supported at launch. Retrofitting i18n into an existing codebase is significantly more expensive than building it in from day one.

---

## Decision

### 1. Library — react-i18next

**react-i18next** is selected as the i18n framework.

It is the most widely used React translation library, has excellent Vite compatibility, and handles all required features:
- String translations
- Pluralisation rules (which vary by language)
- Variable interpolation (e.g. "Welcome, {{name}}")
- Date and number formatting via the browser's native Intl API
- Lazy loading of translation files per language

### 2. Launch language — English only

The app launches in **English only**. Basketball is a global sport with English as its universal language. All current users across Finland, Philippines, Spain, and Canada are served by English at launch.

Additional languages are added when user demand in a specific market justifies the translation effort. The i18n framework makes this additive — a new language is a new translation file, not a code change.

### 3. Translation file structure

All UI strings are stored in JSON translation files, never hardcoded in components:

```
src/
  locales/
    en/
      common.json       ← shared strings (buttons, labels, errors)
      navigation.json   ← sidebar and nav items
      auth.json         ← login, registration, onboarding
      league.json       ← league management strings
      game.json         ← live game and stats strings
      admin.json        ← admin panel strings
```

Example translation file:
```json
// src/locales/en/common.json
{
  "save": "Save",
  "cancel": "Cancel",
  "delete": "Delete",
  "loading": "Loading...",
  "error": "Something went wrong",
  "welcome": "Welcome, {{name}}"
}
```

### 4. Usage in components

No hardcoded strings anywhere in the codebase:

```jsx
// Correct
import { useTranslation } from 'react-i18next';

const { t } = useTranslation('common');
return <button>{t('save')}</button>

// Never do this
return <button>Save</button>
```

This rule applies from the first component written. It is enforced during code review and migration audit.

### 5. Date, time, and number formatting

Handled via the browser's native `Intl` API rather than a library:

```js
// Dates — display in user's locale
new Intl.DateTimeFormat(userLocale, { dateStyle: 'medium' }).format(date)

// Numbers — scores, stats
new Intl.NumberFormat(userLocale).format(number)
```

User locale is detected from the browser (`navigator.language`) and stored on the user's profile. This is separate from the UI language — a Finnish user reading English still sees dates in Finnish format if they prefer.

### 6. Adding a new language later

When a new language is added:
1. Create `src/locales/{lang}/` folder with matching JSON files
2. Translate all strings
3. Register the language in i18next config
4. Add language selector to user profile settings

No component changes required.

---

## Alternatives Considered

### FormatJS (react-intl)

Rejected. More powerful for complex formatting scenarios but significantly more complex to configure. Overkill for Courtside's needs at this stage.

### Hardcode English strings, add i18n later

Rejected. Retrofitting i18n into 75+ existing files is expensive and error-prone. The framework adds minimal overhead when built in from the start.

---

## Consequences

### Positive
- English-only launch keeps scope tight
- Framework in place from day one — adding Spanish, Finnish, or Filipino is a translation task, not a development task
- No hardcoded strings means the codebase is always translation-ready
- Locale-aware date and number formatting works correctly for all users regardless of UI language

### Negative / risks
- Discipline required — developers (and Claude) must never hardcode UI strings
- Translation files must be kept in sync as new features are added — untranslated strings fall back to English silently, which is acceptable behaviour
