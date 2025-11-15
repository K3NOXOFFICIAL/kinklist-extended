This folder contains category and kink SVG icons used by the Kinklist app.

Naming conventions:
- Category icons: assets/icons/category-[class].svg  (class is `strToClass(categoryName)`, e.g., `category-bodies.svg`)
- Kink icons: assets/icons/kink-[class].svg  (class is `strToClass(kinkName)`)

If a specific icon is not present, the app will automatically fall back to:
1) a generic `category-default.svg` or `kink-default.svg` if available
2) a single-letter placeholder (for categories) or a small emoji fallback for kinks.

To add a new icon, put an SVG in the folder using the naming convention above.
