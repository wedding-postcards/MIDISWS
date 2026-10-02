# МИДИС V11 — шрифты

Загружено 2 октября 2026 из официального Google Fonts API / fonts.gstatic.com. Файлы без изменений; локальные CSS-алиасы: Midis Prata и Midis Golos.

- Prata: 400 normal, Иван Петров / Cyreal. [Автор](https://cyreal.org/fonts/prata/), [проект](https://github.com/cyrealtype/Prata).
- Golos Text: variable wght 400–900 normal, Александра Королькова и Виталий Кузьмин / ParaType. [Проект](https://github.com/googlefonts/golos-text). В интерфейсе использовать 400, 500, 600.
- Лицензии OFL 1.1 лежат рядом с файлами.

## Официальные запросы

- [Основные subset](https://fonts.googleapis.com/css2?family=Golos+Text:wght@400..900&family=Prata&display=swap).
- [Prata: отдельный subset ₽](https://fonts.googleapis.com/css2?family=Prata&text=%E2%82%BD&display=swap): стандартный CSS Prata не включает ₽ в диапазоны, поэтому добавлен официальный файл с единственным U+20BD.

## Файлы

| Файл | Байт | Источник | SHA-256 |
|---|---:|---|---|
| prata-400-cyrillic.woff2 | 13132 | [Google Fonts](https://fonts.gstatic.com/s/prata/v22/6xKhdSpbNNCT-sWLCm7JLQ.woff2) | 3392de5a383deac60effcad2beb8b847f40eb0eb200ffd4888c3e13d6e40845f |
| prata-400-latin.woff2 | 19224 | [Google Fonts](https://fonts.gstatic.com/s/prata/v22/6xKhdSpbNNCT-sWPCm4.woff2) | 1b85a8c794709747c9f689b791984c430a2d9716a5cf9440d955bd7d20dad9d0 |
| prata-400-ruble.woff2 | 2488 | [Google Fonts](https://fonts.gstatic.com/l/font?kit=6xKhdSpbNNCT-vWNGGgTrsk&skey=3b0c7d1d6e89685d&v=v22) | 82d39a5680c318b5d03fa7e4a92289ebcb343536842d5aeff13450571ce3356b |
| golos-text-400-900-cyrillic.woff2 | 22032 | [Google Fonts](https://fonts.gstatic.com/s/golostext/v7/q5uCsoe9Lv5t7Meb31EcExd8hLxR.woff2) | 17d048ca05cb1218af3c0d6dcdf882989e6d1cc5dcb598ea50eaf54850ff7229 |
| golos-text-400-900-latin.woff2 | 37916 | [Google Fonts](https://fonts.gstatic.com/s/golostext/v7/q5uCsoe9Lv5t7Meb31EcExN8hA.woff2) | 9a69d0aa4734c4022224c002a3d944a702e0204972a49d892789f5668b922c2a |
| golos-text-400-900-latin-ext.woff2 | 19180 | [Google Fonts](https://fonts.gstatic.com/s/golostext/v7/q5uCsoe9Lv5t7Meb31EcEx18hLxR.woff2) | 05befabe4813f41238ce6ea4f5ecd6b758591e9ef2f303a9932bff68ba66dc66 |

Всего WOFF2: **113972 байт / 111.3 KiB**. Браузер загружает только подходящие unicode-range.

## Проверка

- Таблицы WOFF2 (Brotli), cmap и fvar прочитаны непосредственно.
- В каждой семье 66/66 русских букв, включая Ё/ё; присутствуют цифры 0–9, точка, запятая, двоеточие, точка с запятой, вопросительный и восклицательный знаки, дефис, короткое и длинное тире, кавычки «»/„“”, скобки, процент, плюс, минус, равно и ₽. Учитывалось пересечение реальных glyph с CSS unicode-range.
- Golos: каждый файл действительно содержит ось wght 400–900; также проверены … и №.
- В оригинальной Prata нет № и U+2026 (…). Отсутствие подтверждено в полном официальном TTF Google Fonts. Служебные обозначения с ними набираются Midis Golos; для прочего текста допустим стек Midis Prata, Midis Golos, serif. Не использовать синтетический Bold у Prata.
- Стрелки интерфейса рекомендуется рисовать SVG.

## Подключение

Импортировать сайт/src/fonts-v11.css только в согласованный вариант V11. CSS содержит ровно два семейства, шесть объявлений @font-face с оригинальными диапазонами Google Fonts, font-display:swap.

Для первого русского экрана предварительно загружать **prata-400-cyrillic.woff2** и **golos-text-400-900-cyrillic.woff2** через rel=preload, as=font, type=font/woff2, crossorigin. Остальные файлы оставлять на unicode-range; не делать preload всех шести. При фактическом наличии латинских цифр/римского rail на первом кадре можно отдельно проверить пользу preload нужного Latin subset.
