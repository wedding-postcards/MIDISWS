# Утверждённая типографика МИДИС — 03.10.2026

Пользователь утвердил Alegreya + Roboto как основу визуального стиля. Платные шрифты и остальные кандидаты удалены.

- Alegreya, заголовки: https://raw.githubusercontent.com/google/fonts/main/ofl/alegreya/Alegreya%5Bwght%5D.ttf — SHA256 `ba5564634b93a8f8ba57b48cd4f1ae7417d2b4656fbac779028679b00de3cf12`.
- Roboto, текст и интерфейс: https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf — SHA256 `d7598e12c5dbef095ff8272cfc55da0250bd07fbdecbac8a530b9b277872a134`.
- Лицензии OFL сохранены рядом: `Alegreya-OFL.txt`, `Roboto-OFL.txt`. Разрешены бесплатное использование и веб-встраивание с соблюдением OFL.
- У обоих фактические cmap: русские буквы 66/66 с Ёё, латиница 52/52, ASCII 95/95.
- Настройки утверждённого образца: Alegreya wght 550; Roboto wght 400/600 и настоящая wdth-ось 90%.
- Подключение и переменные: `src/brand-fonts.css`; герой пока использует прежние шрифты до реализации согласованного хедера/хероблока.

Разделитель взят из https://baldursgate3.game/ , Astarion `.character-text .--deco-line`, через CSSOM.
Сохранены оригинальные SVG-наконечники 6×7 и 3×7, линия 190×1px и цвета #e0ccb1/#b78f6d/#ddc9a7.
Computed styles линии и обоих псевдоэлементов совпали с оригиналом. Использование разделителя сейчас — локальный макет.

Образец находится в служебной секции `#type-reference` после пустого `#second-screen`, освобождённого для золотой анимации.
